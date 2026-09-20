import { useState, useEffect } from 'react';
import { teamService } from '../services/api';
import { Navigation, Truck } from 'lucide-react';

export default function RescueAppPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch all teams to populate dropdown
    teamService.getAllTeams().then(data => setTeams(data)).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    let watchId: number;
    if (isTracking && selectedTeamId) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLocation({ lat, lng });
            try {
              await teamService.updateTeamLocation(Number(selectedTeamId), lat, lng);
            } catch (err) {
              console.error("Failed to update location to server", err);
            }
          },
          (err) => {
            setError(err.message);
            setIsTracking(false);
          },
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      } else {
        setError("Geolocation not supported");
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, selectedTeamId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-6">
      <header className="flex items-center space-x-3 border-b border-slate-700 pb-4 mb-6">
        <Truck className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-xl font-bold tracking-wider">Responder Terminal</h1>
          <p className="text-xs text-slate-400">Live GPS Uplink</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col space-y-6">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Select Your Unit</label>
          <select 
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(Number(e.target.value))}
            disabled={isTracking}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Select Unit --</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>
            ))}
          </select>
        </div>

        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded text-sm">{error}</div>}

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-48 h-48 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-500 ${isTracking ? 'border-green-500 bg-green-500/10 shadow-[0_0_40px_rgba(34,197,94,0.3)] animate-pulse' : 'border-slate-700 bg-slate-800'}`}>
            <Navigation className={`w-12 h-12 mb-2 ${isTracking ? 'text-green-500' : 'text-slate-500'}`} />
            <span className="font-mono text-sm uppercase tracking-widest">{isTracking ? 'Transmitting' : 'Standby'}</span>
          </div>

          <div className="mt-8 text-center font-mono text-xs text-slate-400">
            {location ? (
              <div>
                LAT: <span className="text-blue-400">{location.lat.toFixed(6)}</span><br/>
                LNG: <span className="text-blue-400">{location.lng.toFixed(6)}</span>
              </div>
            ) : 'GPS Coordinates Unknown'}
          </div>
        </div>

        <button 
          onClick={() => setIsTracking(!isTracking)}
          disabled={!selectedTeamId}
          className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider transition-all ${isTracking ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed'}`}
        >
          {isTracking ? 'Stop Tracking' : 'Start Live Uplink'}
        </button>
      </main>
    </div>
  );
}
