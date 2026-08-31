import { useState } from 'react';
import { MapPin, Upload, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { reportService, authService } from '../services/api';

export default function CitizenReportPage() {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [formData, setFormData] = useState({
    disaster_type: '',
    description: '',
    people_count: 0,
    vulnerable_count: 0,
  });
  
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleGetLocation = () => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please ensure location permissions are granted.");
          setLoadingLocation(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setLoadingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to submit a report.");
      navigate('/login');
      return;
    }
    if (!location) {
      alert("Please provide your location so rescue teams can find you.");
      return;
    }
    if (!formData.disaster_type || !formData.description) {
      alert("Please fill all required fields.");
      return;
    }

    setLoadingSubmit(true);
    try {
      await reportService.createReport({
        ...formData,
        latitude: location.lat,
        longitude: location.lng,
      });
      alert('Emergency report submitted successfully! Responders have been notified.');
      // Optional: navigate('/my-reports')
      setFormData({ disaster_type: '', description: '', people_count: 0, vulnerable_count: 0 });
      setLocation(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit report. Please try again.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-red-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-6 w-6" />
          <span className="text-xl font-bold">Report Emergency</span>
        </div>
        <div className="space-x-4">
          <span className="text-sm">Hi, {user?.name || 'Citizen'}</span>
          <Link to="/" className="text-sm font-medium hover:underline border border-white px-2 py-1 rounded">Logout</Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Emergency Details</h2>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disaster Type *</label>
              <select 
                required
                value={formData.disaster_type}
                onChange={(e) => setFormData({...formData, disaster_type: e.target.value})}
                className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Select a disaster type...</option>
                <option value="flood">Flood / Waterlogging</option>
                <option value="fire">Fire</option>
                <option value="earthquake">Earthquake / Structural Damage</option>
                <option value="medical">Medical Emergency</option>
                <option value="accident">Major Accident</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea 
                required
                rows={4} 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500"
                placeholder="Briefly describe the situation..."
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">People Affected (Approx)</label>
                <input 
                  type="number" min="0" 
                  value={formData.people_count}
                  onChange={(e) => setFormData({...formData, people_count: parseInt(e.target.value) || 0})}
                  className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vulnerable People (Children/Elderly)</label>
                <input 
                  type="number" min="0" 
                  value={formData.vulnerable_count}
                  onChange={(e) => setFormData({...formData, vulnerable_count: parseInt(e.target.value) || 0})}
                  className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <div className="flex items-center space-x-2">
                <button 
                  type="button" 
                  onClick={handleGetLocation}
                  disabled={loadingLocation}
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-lg border transition"
                >
                  <MapPin className="h-5 w-5 text-red-500" />
                  <span>{loadingLocation ? 'Getting location...' : 'Use My Current Location'}</span>
                </button>
                {location && <span className="text-sm text-green-600 font-medium">Location captured ✓ ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</span>}
              </div>
            </div>

            <button disabled={loadingSubmit} type="submit" className="w-full bg-red-600 text-white font-bold text-lg py-4 rounded-lg shadow hover:bg-red-700 transition disabled:opacity-50">
              {loadingSubmit ? 'Submitting...' : 'Submit Emergency Report'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
