import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Camera, MapPin, Send, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Component to recenter picker map when coordinate fields are typed manually
const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

// Component to handle map clicks and place/render the marker
const LocationMarker = ({ 
  lat, 
  lng, 
  setLat, 
  setLng 
}: { 
  lat: number; 
  lng: number; 
  setLat: (val: string) => void; 
  setLng: (val: string) => void; 
}) => {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat.toFixed(6));
      setLng(e.latlng.lng.toFixed(6));
    },
  });

  const customIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });

  return (
    <Marker position={[lat, lng]} icon={customIcon} />
  );
};

export const Report: React.FC = () => {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Redirect officers away from this page
  useEffect(() => {
    if (user && user.role === 'officer') {
      navigate('/officer/cases');
    }
  }, [user, navigate]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('19.0760');
  const [longitude, setLongitude] = useState('72.8777');
  const [category, setCategory] = useState('other');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Nominatim Search & GPS states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearchArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchError('');
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error('Search failed');
      }
      const data = await res.json();
      if (data && data.length > 0) {
        const firstResult = data[0];
        setLatitude(parseFloat(firstResult.lat).toFixed(6));
        setLongitude(parseFloat(firstResult.lon).toFixed(6));
        setSearchError('');
      } else {
        setSearchError('Location not found. Try a different term.');
      }
    } catch (err) {
      setSearchError('Failed to fetch area. Please check connection.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toFixed(6));
          setLongitude(position.coords.longitude.toFixed(6));
          setError('');
        },
        (err) => {
          console.error("GPS failed:", err);
          setError("Failed to retrieve GPS location. Enable location permissions.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (!selectedFile.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        return;
      }
      
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be under 5MB.');
        return;
      }

      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setError('');
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Automatically retrieve user's current coordinates for reporting
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toFixed(6));
          setLongitude(position.coords.longitude.toFixed(6));
        },
        (err) => {
          console.log("Error fetching user geolocation:", err);
        }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');

    if (!file) {
      setError("Application rejected: An image upload is required to submit a complaint. Please select a photo.");
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;
      
      // Upload image first if one is selected
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/api/v1/reports/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!uploadResponse.ok) {
          const uploadErr = await uploadResponse.json();
          throw new Error(uploadErr.detail || 'Failed to upload photo.');
        }
        
        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.image_url;
      }

      // Submit case with image URL
      const response = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          category,
          image_url: imageUrl
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit report.');
      }

      // Navigate to tracking page for this ticket
      navigate(`/track/${data.ticket_id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Submit Civic Complaint</h1>
        <p className="text-sm text-slate-400 mb-8">
          Upload a required photo, describe the issue, and pin its location. AI will classify and route it.
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Uploader */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-2 block">Upload Photo (Required)</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/50 rounded-xl p-8 text-center cursor-pointer transition-all relative overflow-hidden min-h-[160px] flex flex-col justify-center items-center"
            >
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="max-h-[140px] rounded-lg object-contain" />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 hover:bg-rose-600 border border-slate-800 hover:border-rose-500 text-white transition-all shadow-md"
                    title="Remove Image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                  <span className="text-sm text-slate-400 font-medium">Click to select or drop image here</span>
                  <p className="text-xs text-slate-600 mt-1">PNG, JPG or WEBP (Max 5MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-2 block">Issue Description</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
              placeholder="Please provide details (e.g. 'Large pothole blocking the southbound lane on 4th Ave near Pine St.')"
            />
          </div>

          {/* Coordinates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Latitude</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Longitude</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl py-2.5 pl-10 pr-4 text-white text-sm outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Map Location Picker */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <label className="text-xs font-semibold text-slate-400">
                Pinpoint issue location (Search area or click on map)
              </label>
              <button
                type="button"
                onClick={handleUseGPS}
                className="self-start sm:self-auto bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal border border-accent-teal/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-sm"
              >
                <MapPin className="h-3 w-3" />
                Share My Live GPS Location
              </button>
            </div>

            {/* Geocoding Search Bar */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search area, street, or landmark (e.g. Bandra, Mumbai)..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl px-3 py-2 text-white text-xs outline-none transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchArea(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchArea}
                  disabled={searchLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 min-w-[80px]"
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {searchError && (
                <p className="text-[11px] text-rose-400 mt-1 font-semibold">{searchError}</p>
              )}
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl h-64 overflow-hidden relative z-10">
              <MapContainer 
                center={[parseFloat(latitude) || 19.0760, parseFloat(longitude) || 72.8777]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <RecenterMap center={[parseFloat(latitude) || 19.0760, parseFloat(longitude) || 72.8777]} />
                 <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url={theme === 'light'
                    ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
                />
                <LocationMarker 
                  lat={parseFloat(latitude) || 19.0760} 
                  lng={parseFloat(longitude) || 72.8777} 
                  setLat={setLatitude} 
                  setLng={setLongitude} 
                />
              </MapContainer>
            </div>
          </div>

          {/* Initial Category */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-2 block">Category Selection (Initial guess)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue rounded-xl p-3 text-white text-sm outline-none transition-all"
            >
              <option value="other">Other / Unsure</option>
              <option value="pothole">Pothole</option>
              <option value="streetlight">Streetlight Outage</option>
              <option value="drainage">Drainage Overflow</option>
              <option value="garbage">Garbage / Litter Pile</option>
              <option value="road_damage">Road Damage</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue disabled:opacity-50 transition-all shadow-lg shadow-accent-blue/20"
          >
            {loading ? 'Submitting...' : 'Submit Case'}
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
