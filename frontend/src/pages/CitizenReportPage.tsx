import { useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { reportService, authService } from '../services/api';
import AIChatbot from '../components/AIChatbot';

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
  
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const dict = {
    en: {
      report_emergency: "Report Emergency",
      logout: "Logout",
      emergency_details: "Emergency Details",
      disaster_type: "Disaster Type *",
      select_disaster: "Select a disaster type...",
      flood: "Flood / Waterlogging",
      fire: "Fire",
      earthquake: "Earthquake / Structural Damage",
      medical: "Medical Emergency",
      accident: "Major Accident",
      other: "Other",
      description: "Description *",
      desc_placeholder: "Briefly describe the situation...",
      people_affected: "People Affected (Approx)",
      vulnerable_people: "Vulnerable People (Children/Elderly)",
      location: "Location *",
      getting_location: "Getting location...",
      use_my_location: "Use My Current Location",
      location_captured: "Location captured ✓",
      submitting: "Submitting...",
      submit: "Submit Emergency Report"
    },
    hi: {
      report_emergency: "आपातकालीन रिपोर्ट करें",
      logout: "लॉग आउट",
      emergency_details: "आपातकालीन विवरण",
      disaster_type: "आपदा का प्रकार *",
      select_disaster: "आपदा का प्रकार चुनें...",
      flood: "बाढ़ / जलभराव",
      fire: "आग",
      earthquake: "भूकंप / संरचनात्मक क्षति",
      medical: "चिकित्सा आपातकाल",
      accident: "बड़ी दुर्घटना",
      other: "अन्य",
      description: "विवरण *",
      desc_placeholder: "स्थिति का संक्षेप में वर्णन करें...",
      people_affected: "प्रभावित लोग (लगभग)",
      vulnerable_people: "असुरक्षित लोग (बच्चे/बुजुर्ग)",
      location: "स्थान (लोकेशन) *",
      getting_location: "लोकेशन प्राप्त कर रहे हैं...",
      use_my_location: "मेरी वर्तमान लोकेशन का उपयोग करें",
      location_captured: "लोकेशन प्राप्त हो गई ✓",
      submitting: "सबमिट कर रहे हैं...",
      submit: "आपातकालीन रिपोर्ट सबमिट करें"
    }
  };

  const t = dict[language];

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
          <span className="text-xl font-bold">{t.report_emergency}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setLanguage(lang => lang === 'en' ? 'hi' : 'en')}
            className="text-xs bg-white text-red-600 font-bold px-3 py-1 rounded-full shadow hover:bg-red-100 transition"
          >
            {language === 'en' ? 'A / अ (Hindi)' : 'A / अ (English)'}
          </button>
          <span className="text-sm hidden sm:inline">Hi, {user?.name || 'Citizen'}</span>
          <Link to="/" className="text-sm font-medium hover:underline border border-white px-2 py-1 rounded">{t.logout}</Link>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.emergency_details}</h2>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.disaster_type}</label>
              <select 
                required
                value={formData.disaster_type}
                onChange={(e) => setFormData({...formData, disaster_type: e.target.value})}
                className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">{t.select_disaster}</option>
                <option value="flood">{t.flood}</option>
                <option value="fire">{t.fire}</option>
                <option value="earthquake">{t.earthquake}</option>
                <option value="medical">{t.medical}</option>
                <option value="accident">{t.accident}</option>
                <option value="other">{t.other}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
              <textarea 
                required
                rows={4} 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500"
                placeholder={t.desc_placeholder}
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.people_affected}</label>
                <input 
                  type="number" min="0" 
                  value={formData.people_count}
                  onChange={(e) => setFormData({...formData, people_count: parseInt(e.target.value) || 0})}
                  className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.vulnerable_people}</label>
                <input 
                  type="number" min="0" 
                  value={formData.vulnerable_count}
                  onChange={(e) => setFormData({...formData, vulnerable_count: parseInt(e.target.value) || 0})}
                  className="w-full border-gray-300 rounded-lg shadow-sm border p-3 focus:ring-red-500 focus:border-red-500" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.location}</label>
              <div className="flex items-center space-x-2">
                <button 
                  type="button" 
                  onClick={handleGetLocation}
                  disabled={loadingLocation}
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-lg border transition"
                >
                  <MapPin className="h-5 w-5 text-red-500" />
                  <span>{loadingLocation ? t.getting_location : t.use_my_location}</span>
                </button>
                {location && <span className="text-sm text-green-600 font-medium">{t.location_captured} ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</span>}
              </div>
            </div>

            <button disabled={loadingSubmit} type="submit" className="w-full bg-red-600 text-white font-bold text-lg py-4 rounded-lg shadow hover:bg-red-700 transition disabled:opacity-50">
              {loadingSubmit ? t.submitting : t.submit}
            </button>
          </form>
        </div>
      </main>

      {/* Floating AI Assistant */}
      <AIChatbot />

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 text-xs text-center py-3 mt-auto">
        &copy; {new Date().getFullYear()} Team HackHawks. All rights reserved.
      </footer>
    </div>
  );
}
