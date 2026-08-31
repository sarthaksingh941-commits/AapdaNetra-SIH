import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="bg-blue-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-red-500" />
          <span className="text-xl font-bold">AapdaNetra</span>
        </div>
        <nav className="space-x-4">
          <Link to="/login" className="hover:text-blue-200">Login</Link>
          <Link to="/register" className="bg-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-500">Register</Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-blue-50 to-white">
        <AlertTriangle className="h-20 w-20 text-red-500 mb-6" />
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4">
          AI-Powered Disaster Intelligence
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl">
          Transforming scattered citizen reports into verified, prioritized, and map-based rescue intelligence. 
          Help disaster-response teams decide what needs attention first.
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <Link 
            to="/report" 
            className="bg-red-600 text-white text-lg px-8 py-4 rounded-lg font-bold shadow-lg hover:bg-red-700 transition"
          >
            Report Emergency
          </Link>
          <Link 
            to="/dashboard" 
            className="bg-white text-blue-900 border-2 border-blue-900 text-lg px-8 py-4 rounded-lg font-bold shadow hover:bg-blue-50 transition"
          >
            Command Dashboard
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6 border rounded-xl shadow-sm">
            <ShieldCheck className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Verified Intelligence</h3>
            <p className="text-gray-600">AI-assisted verification removes spam and groups duplicate reports automatically.</p>
          </div>
          <div className="p-6 border rounded-xl shadow-sm">
            <Activity className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Smart Priority</h3>
            <p className="text-gray-600">Rule-based scoring prioritizes critical incidents based on vulnerable people and severity.</p>
          </div>
          <div className="p-6 border rounded-xl shadow-sm">
            <AlertTriangle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Live Situation Map</h3>
            <p className="text-gray-600">Geolocated incident mapping helps rescue teams dispatch resources effectively.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
