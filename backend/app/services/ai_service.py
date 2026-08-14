import os
import io
import re
import logging
from typing import List, Tuple, Dict, Any, Optional
from PIL import Image
from app.config import settings

# Configure logging
logger = logging.getLogger("app.ai_service")

# Lazy load ML libraries only if MOCK_AI is False and we actually call the service
torch = None
timm = None
transforms = None

def _import_ml_libraries():
    global torch, timm, transforms
    if torch is None:
        try:
            import torch as _torch
            import timm as _timm
            import torchvision.transforms as _transforms
            torch = _torch
            timm = _timm
            transforms = _transforms
            logger.info("ML libraries (torch, timm, torchvision) successfully imported.")
        except ImportError as e:
            logger.error(f"Failed to import ML libraries: {e}")
            raise RuntimeError(
                "ML libraries (torch, torchvision, timm) are not installed or failed to load. "
                "Ensure they are installed in your backend environment."
            ) from e

class AIService:
    _instance = None
    _model = None
    _class_names = []
    _image_size = 224
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AIService, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def initialize(self):
        if self._initialized or settings.MOCK_AI:
            return
        
        _import_ml_libraries()
        model_path = settings.IMAGE_MODEL_PATH
        if not os.path.exists(model_path):
            logger.error(f"AI Model file not found at path: {model_path}")
            # Fallback to mock mode if model file is missing to keep system working
            logger.warning("AI model file not found; falling back to rule-based classification.")
            self._initialized = False
            return

        try:
            logger.info(f"Loading AI model from {model_path}...")
            # Load PyTorch checkpoint
            checkpoint = torch.load(model_path, map_location=torch.device('cpu'), weights_only=False)
            self._class_names = checkpoint['class_names']
            self._image_size = checkpoint.get('image_size', 224)
            model_name = checkpoint.get('model_name', 'efficientnet_b0')

            logger.info(f"Instantiating model {model_name} with {len(self._class_names)} classes...")
            # Recreate model structure
            self._model = timm.create_model(model_name, num_classes=len(self._class_names))
            self._model.load_state_dict(checkpoint['model_state_dict'])
            self._model.eval()
            self._initialized = True
            logger.info("AI Model successfully loaded and initialized.")
        except Exception as e:
            logger.exception(f"Error initializing PyTorch model: {e}")
            self._initialized = False

    def predict_image(self, image_bytes: bytes) -> Tuple[str, float]:
        """Runs image prediction using the PyTorch EfficientNet-B0 model."""
        if settings.MOCK_AI or not self._initialized:
            logger.info("AI Service not initialized or MOCK_AI active. Simulating mock image prediction.")
            return "pothole", 0.85

        try:
            _import_ml_libraries()
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # Match preprocessing from model training
            preprocess = transforms.Compose([
                transforms.Resize((self._image_size, self._image_size)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])

            input_tensor = preprocess(image).unsqueeze(0)
            
            with torch.no_grad():
                outputs = self._model(input_tensor)
                probabilities = torch.softmax(outputs, dim=1)[0]
                
            conf, idx = torch.max(probabilities, dim=0)
            predicted_class = self._class_names[idx.item()]
            confidence = conf.item()
            
            logger.info(f"Image classification result: {predicted_class} (confidence: {confidence:.2f})")
            return predicted_class, confidence
        except Exception as e:
            logger.exception(f"Failed to perform image prediction: {e}")
            return "other", 0.0

    def predict_text(self, description: str) -> Tuple[str, float]:
        """Runs text prediction based on keyword/regex rules."""
        desc_lower = description.lower()
        
        # Mapping keyword patterns to categories and base confidences
        rules = [
            (r"\bpothole\b|\bcracked asphalt\b|\bhole in the road\b|\broad damage\b|\bcracks?\b", "pothole", 0.85),
            (r"\bstreetlight\b|\blight out\b|\bdark street\b|\bbulb out\b|\blamppost\b", "streetlight", 0.90),
            (r"\bdrainage\b|\boverflow\b|\bclogged drain\b|\bflooding\b|\bsewer\b|\bleak\b", "drainage", 0.88),
            (r"\bgarbage\b|\btrash\b|\blitter\b|\bdumping\b|\bwaste\b|\brefuse\b", "garbage", 0.92),
            (r"\bgraffiti\b|\bvandalism\b|\bvandalized\b|\bspray paint\b|\bbroken window\b", "vandalism", 0.85),
            (r"\bsign\b|\bsignal\b|\btraffic light\b|\broad sign\b|\bstop sign\b", "road_sign", 0.80),
        ]
        
        best_category = "other"
        best_confidence = 0.50
        
        for pattern, category, confidence in rules:
            if re.search(pattern, desc_lower):
                # If multiple keywords match, pick the one with highest confidence
                if confidence > best_confidence:
                    best_category = category
                    best_confidence = confidence
                    
        return best_category, best_confidence

    def verify_complaint(
        self,
        description: str,
        latitude: float,
        longitude: float,
        image_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Combines text analysis and image analysis to verify and auto-classify a complaint.
        """
        # 1. Initialize model if needed
        self.initialize()
        
        image_prediction = None
        image_confidence = 0.0
        
        # 2. Run image inference if image bytes are provided
        if image_bytes and (self._initialized or settings.MOCK_AI):
            image_prediction, image_confidence = self.predict_image(image_bytes)
            
        # 3. Run text inference
        text_prediction, text_confidence = self.predict_text(description)
        
        # 4. Blend predictions
        # Rules:
        # - If we have an image prediction with > 0.40 confidence, we prioritize it because it is visual evidence.
        # - Otherwise, use the text prediction if it found keywords (confidence > 0.5).
        # - Otherwise fall back to 'other'.
        if image_prediction and image_confidence > 0.40:
            final_category = image_prediction
            final_confidence = image_confidence
        elif text_prediction != "other":
            final_category = text_prediction
            final_confidence = text_confidence
        else:
            final_category = "other"
            final_confidence = 0.50
            
        # 5. Extract keywords from description for metadata
        all_words = re.findall(r"\b\w{4,15}\b", description.lower())
        stop_words = {"this", "that", "there", "their", "about", "would", "could", "should", "please"}
        keywords = list(set([w for w in all_words if w not in stop_words]))[:5]
        
        # 6. Set location context
        location_context = [f"Lat: {latitude:.4f}", f"Lng: {longitude:.4f}"]
        
        # 7. Determine severity, routing, and SLA based on category
        severity = "LOW"
        department = "General Civic Services"
        sla_hours = 48
        
        if final_category == "drainage":
            severity = "HIGH"
            department = "Water & Drainage"
            sla_hours = 12
        elif final_category == "road_damage":
            severity = "HIGH"
            department = "Public Works"
            sla_hours = 12
        elif final_category in ("pothole", "garbage", "vandalism"):
            severity = "MEDIUM"
            sla_hours = 24
            if final_category == "pothole":
                department = "Public Works"
            elif final_category == "garbage":
                department = "Sanitation Department"
            else:
                department = "General Civic Services"
        elif final_category == "streetlight":
            severity = "LOW"
            department = "Electrical Department"
            sla_hours = 48
        elif final_category == "road_sign":
            severity = "LOW"
            department = "Public Works"
            sla_hours = 48
            
        # 8. Priority score formula
        # Base: HIGH=7.0, MEDIUM=4.0, LOW=1.0
        # Plus confidence * 3.0 (gives 0.0 to 3.0 bonus)
        # Result scale: 0.0 to 10.0
        base_score = {"HIGH": 7.0, "MEDIUM": 4.0, "LOW": 1.0}[severity]
        priority_score = min(base_score + (final_confidence * 3.0), 10.0)
        
        return {
            "category": final_category,
            "confidence": final_confidence,
            "severity": severity,
            "priority_score": priority_score,
            "priority_level": severity,
            "keywords": keywords,
            "location_context": location_context,
            "image_prediction": image_prediction,
            "image_confidence": image_confidence,
            "text_prediction": text_prediction,
            "department": department,
            "sla_hours": sla_hours
        }

# Singleton instance
ai_service = AIService()
