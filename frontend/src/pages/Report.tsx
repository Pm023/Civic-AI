import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, MapPin, Send } from 'lucide-react';
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
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('19.0760');
  const [longitude, setLongitude] = useState('72.8777');
  const [category, setCategory] = useState('other');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      // Phase 1 / 2 integration
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
          category
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
          Upload an optional photo, describe the issue, and pin its location. AI will classify and route it.
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Uploader Placeholder */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-2 block">Upload Photo (Optional)</label>
            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/50 rounded-xl p-8 text-center cursor-pointer transition-all">
              <Camera className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <span className="text-sm text-slate-400 font-medium">Click to select or drop image here</span>
              <p className="text-xs text-slate-600 mt-1">PNG, JPG or WEBP (Max 5MB)</p>
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
            <label className="text-xs font-semibold text-slate-400 mb-2 block">
              Click on the map to pinpoint issue location
            </label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl h-64 overflow-hidden relative z-10">
              <MapContainer 
                center={[parseFloat(latitude) || 19.0760, parseFloat(longitude) || 72.8777]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <RecenterMap center={[parseFloat(latitude) || 19.0760, parseFloat(longitude) || 72.8777]} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
