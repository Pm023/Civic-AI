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
models = None

def _import_ml_libraries():
    global torch, timm, transforms, models
    if torch is None:
        try:
            import torch as _torch
            import timm as _timm
            import torchvision.transforms as _transforms
            import torchvision.models as _models
            torch = _torch
            timm = _timm
            transforms = _transforms
            models = _models
            logger.info("ML libraries (torch, timm, torchvision, models) successfully imported.")
        except ImportError as e:
            logger.error(f"Failed to import ML libraries: {e}")
            raise RuntimeError(
                "ML libraries (torch, torchvision, timm) are not installed or failed to load. "
                "Ensure they are installed in your backend environment."
            ) from e

BLACKLIST_KEYWORDS = [
    # Nature / Plants
    "flower", "rose", "daisy", "tulip", "sunflower", "orchid", "hibiscus", "marigold", 
    "pansy", "primrose", "cardoon", "dahlia", "lily", "flora", "plant", "leaf", "leaves", 
    "grass", "tree", "forest", "wood", "moss", "clover", "petal", "shrub", "bush", 
    "cactus", "succulent", "mushroom", "fungus", "agaric", "bolete", "stinkhorn",
    
    # Animals / Pets / Insects
    "dog", "puppy", "hound", "terrier", "retriever", "spaniel", "shepherd", "collie", 
    "mastiff", "boxer", "bulldog", "poodle", "husky", "malamute", "chihuahua", 
    "cat", "kitten", "tabby", "siamese", "persian", "cougar", "leopard", "lion", 
    "tiger", "cheetah", "jaguar", "panther", "lynx", "bobcat", "bird", "parrot", 
    "sparrow", "robin", "finch", "eagle", "hawk", "falcon", "owl", "penguin", "duck", 
    "goose", "swan", "chicken", "rooster", "hen", "turkey", "peacock", "flamingo", 
    "fish", "shark", "whale", "dolphin", "salmon", "trout", "goldfish", "koi", 
    "insect", "bug", "ant", "bee", "wasp", "hornet", "butterfly", "moth", "beetle", 
    "spider", "scorpion", "caterpillar", "dragonfly", "fly", "mosquito", "cricket", 
    "grasshopper", "locust", "tick", "flea", "worm", "slug", "snail", "snake", 
    "lizard", "turtle", "tortoise", "crocodile", "alligator", "frog", "toad", 
    "salamander", "newt", "chameleon", "gecko", "iguana", "bear", "panda", "koala", 
    "monkey", "ape", "chimpanzee", "gorilla", "orangutan", "baboon", "gibbon", 
    "lemur", "squirrel", "chipmunk", "rabbit", "bunny", "hare", "mouse", "rat", 
    "hamster", "guinea pig", "gerbil", "gopher", "beaver", "otter", "badger", 
    "weasel", "ferret", "mink", "raccoon", "opossum", "deer", "elk", "moose", 
    "caribou", "reindeer", "antelope", "gazelle", "impala", "sheep", "lamb", 
    "ram", "ewe", "goat", "billy goat", "nanny goat", "kid", "cow", "bull", 
    "heifer", "calf", "steer", "ox", "bison", "buffalo", "pig", "piglet", 
    "hog", "sow", "boar", "horse", "foal", "colt", "filly", "mare", "stallion", 
    "pony", "donkey", "mule", "camel", "llama", "alpaca", "giraffe", "zebra", 
    "hippopotamus", "rhinoceros", "elephant", "kangaroo", "koala", "platypus",
    
    # Food / Fruits / Vegetables / Kitchen
    "food", "dish", "meal", "recipe", "ingredient", "fruit", "apple", "banana", 
    "orange", "grape", "strawberry", "blueberry", "raspberry", "blackberry", 
    "cherry", "peach", "pear", "plum", "apricot", "plumcot", "nectarine", 
    "mango", "papaya", "pineapple", "coconut", "lemon", "lime", "grapefruit", 
    "tangerine", "clementine", "satsuma", "kumquat", "fig", "date", "prune", 
    "raisin", "cranberry", "pomegranate", "watermelon", "cantaloupe", "honeydew", 
    "melon", "vegetable", "tomato", "potato", "carrot", "onion", "garlic", 
    "leek", "shallot", "chive", "scallion", "broccoli", "cauliflower", 
    "cabbage", "kale", "spinach", "lettuce", "salad", "cucumber", "zucchini", 
    "squash", "pumpkin", "eggplant", "pepper", "bell pepper", "chili", "jalapeno", 
    "habanero", "cayenne", "paprika", "corn", "maize", "pea", "bean", "lentil", 
    "chickpea", "soybean", "tofu", "tempeh", "nut", "peanut", "almond", 
    "walnut", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "chestnut", 
    "coconut", "seed", "sunflower seed", "pumpkin seed", "sesame seed", 
    "chia seed", "flax seed", "grain", "rice", "wheat", "barley", "oat", 
    "rye", "quinoa", "millet", "sorghum", "buckwheat", "flour", "bread", 
    "bun", "roll", "bagel", "croissant", "pastry", "cake", "cupcake", 
    "cookie", "biscuit", "pie", "tart", "donut", "doughnut", "muffin", 
    "scone", "pancake", "waffle", "crepe", "toast", "sandwich", "burger", 
    "hamburger", "cheeseburger", "hot dog", "hotdog", "pizza", "pasta", 
    "spaghetti", "macaroni", "noodle", "ramen", "soup", "stew", "chowder", 
    "broth", "sauce", "gravy", "dressing", "dip", "salsa", "guacamole", 
    "hummus", "cheese", "butter", "margarine", "yogurt", "milk", "cream", 
    "sour cream", "ice cream", "gelato", "sorbet", "sherbet", "custard", 
    "pudding", "chocolate", "candy", "sweet", "caramel", "fudge", "marshmallow", 
    "honey", "syrup", "sugar", "salt", "pepper", "herb", "spice", "basil", 
    "oregano", "thyme", "rosemary", "parsley", "cilantro", "mint", "dill", 
    "sage", "pot", "crockpot", "wok", "frying pan", "saucepan", "skillet",
    
    # People / Clothing / Faces
    "person", "man", "woman", "boy", "girl", "child", "baby", "infant", "toddler", 
    "teenager", "adult", "elderly", "senior", "face", "head", "eye", "ear", 
    "nose", "mouth", "lip", "tooth", "teeth", "tongue", "cheek", "chin", 
    "neck", "throat", "shoulder", "arm", "elbow", "wrist", "hand", "finger", 
    "thumb", "chest", "breast", "belly", "abdomen", "waist", "hip", "leg", 
    "thigh", "knee", "shin", "calf", "ankle", "foot", "toe", "heel", "skin", 
    "hair", "beard", "mustache", "clothing", "clothes", "outfit", "garment", 
    "apparel", "attire", "wear", "dress", "skirt", "gown", "robe", "suit", 
    "tuxedo", "jacket", "coat", "blazer", "sweater", "cardigan", "pullover", 
    "hoodie", "sweatshirt", "shirt", "t-shirt", "tshirt", "blouse", "top", 
    "pant", "pants", "trousers", "jeans", "shorts", "leggings", "sweatpants", 
    "underwear", "underpants", "boxers", "briefs", "panties", "bra", 
    "brassiere", "sock", "socks", "stocking", "stockings", "shoe", "shoes", 
    "boot", "boots", "sneaker", "sneakers", "sandal", "sandals", "slipper", 
    "slippers", "hat", "cap", "beanie", "helmet", "visor", "bandana", 
    "scarf", "tie", "necktie", "bowtie", "glove", "gloves", "mitten", 
    "mittens", "belt", "suspender", "suspenders",
    
    # Indoor / Household Furniture & Appliances
    "furniture", "chair", "armchair", "sofa", "couch", "loveseat", "futon", 
    "stool", "bench", "table", "desk", "bed", "mattress", "pillow", "cushion", 
    "blanket", "sheet", "duvet", "comforter", "quilt", "dresser", "chest of drawers", 
    "cabinet", "cupboard", "wardrobe", "closet", "shelf", "shelves", "bookcase", 
    "bookshelf", "nightstand", "bedside table", "console table", "coffee table", 
    "sideboard", "buffet", "hutch", "desk chair", "office chair", "folding chair", 
    "rocking chair", "recliner", "ottoman", "bean bag", "cradle", "crib", 
    "bassinet", "high chair", "playpen", "appliance", "refrigerator", "fridge", 
    "freezer", "stove", "oven", "range", "cooktop", "microwave", "toaster", 
    "toaster oven", "blender", "food processor", "mixer", "coffee maker", 
    "espresso machine", "juicer", "crockpot", "slow cooker", "pressure cooker", 
    "rice cooker", "air fryer", "griddle", "waffle maker", "sandwich maker", 
    "dishwasher", "washing machine", "dryer", "washer-dryer combo", 
    "vacuum cleaner", "handheld vacuum", "robot vacuum", "steam mop", 
    "carpet cleaner", "air purifier", "humidifier", "dehumidifier", 
    "space heater", "fan", "ceiling fan", "air conditioner", "portable AC", 
    "water heater", "boiler", "furnace", "thermostat", "iron", "ironing board", 
    "steamer", "sewing machine", "hair dryer", "curling iron", "straightener", 
    "shaver", "electric razor", "toothbrush", "electric toothbrush", 
    "scale", "bathroom scale", "baby monitor", "smoke detector", 
    "carbon monoxide detector", "security camera", "smart speaker", 
    "smart hub", "laptop", "notebook", "desktop", "computer", "keyboard",
    "mouse", "touchpad", "monitor", "screen", "television", "tv", "remote",
    "joystick", "gamepad", "console", "headphones", "earphones", "earbuds",
    "microphone", "speaker", "soundbar", "amplifier", "receiver", "projector",
    "printer", "scanner", "copier", "fax machine", "shredder", "calculator",
    "typewriter", "telephone", "phone", "cellphone", "smartphone", "tablet",
    "e-reader", "smartwatch", "fitness tracker", "charger", "power bank",
    "cable", "wire", "plug", "socket", "outlet", "adapter", "connector",
    "battery", "power strip", "surge protector", "extension cord", "candle",
    "vase", "soap", "toothpaste", "toilet paper"
]

class AIService:
    _instance = None
    _model = None
    _class_names = []
    _image_size = 224
    _initialized = False
    _imagenet_model = None
    _imagenet_categories = []

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

    def validate_image_distribution(self, image_bytes: bytes) -> Tuple[bool, Optional[str]]:
        """
        Validates if the image is within a normal public civic issue domain.
        Uses a lightweight pre-trained ImageNet model to detect plants, animals, food, indoor items.
        Returns:
            Tuple[bool, Optional[str]]: (is_allowed, matched_class_name)
        """
        if settings.MOCK_AI:
            # In mock mode, we assume mock image is allowed
            return True, None
            
        try:
            _import_ml_libraries()
            if not self._imagenet_model:
                logger.info("Initializing pre-trained MobileNetV3-Small for OOD image validation...")
                weights = models.MobileNet_V3_Small_Weights.DEFAULT
                self._imagenet_categories = weights.meta["categories"]
                self._imagenet_model = models.mobilenet_v3_small(weights=weights)
                self._imagenet_model.eval()
                
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # MobileNet standard preprocessing
            preprocess = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
            
            input_tensor = preprocess(image).unsqueeze(0)
            
            with torch.no_grad():
                outputs = self._imagenet_model(input_tensor)
                probabilities = torch.softmax(outputs, dim=1)[0]
                
            top5_prob, top5_catid = torch.topk(probabilities, 5)
            
            # Check the top 3 predictions
            for i in range(3):
                idx = top5_catid[i].item()
                cat_name = self._imagenet_categories[idx].lower()
                
                # Split category name into words and match against blacklist
                words = re.findall(r"\b[a-z]{3,15}\b", cat_name)
                for w in words:
                    if w in BLACKLIST_KEYWORDS:
                        logger.warning(f"Image rejected as OOD. Matched blacklisted category: {cat_name}")
                        return False, cat_name
                        
            return True, None
        except Exception as e:
            logger.exception(f"Error during ImageNet OOD validation: {e}")
            # Fallback to True if validation fails to keep system functioning
            return True, None

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
        image_allowed = True
        image_matched_class = None
        
        # 2. Run image inference if image bytes are provided
        if image_bytes:
            image_allowed, image_matched_class = self.validate_image_distribution(image_bytes)
            if image_allowed and (self._initialized or settings.MOCK_AI):
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
            "image_allowed": image_allowed,
            "image_matched_class": image_matched_class,
            "text_prediction": text_prediction,
            "department": department,
            "sla_hours": sla_hours
        }

# Singleton instance
ai_service = AIService()
