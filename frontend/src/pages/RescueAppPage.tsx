import { useState, useEffect } from 'react';
import { teamService, incidentService } from '../services/api';
import { Navigation, Truck, BellRing, CheckCircle, Map as MapIcon, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RescueAppPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [error, setError] = useState('');

  // 1. Fetch teams on load
  useEffect(() => {
    teamService.getAllTeams().then(data => setTeams(data)).catch(err => console.error(err));
  }, []);

  // 2. Poll for assignments if a team is selected
  useEffect(() => {
    let interval: any;
    if (selectedTeamId) {
      const checkAssignment = async () => {
        try {
          const data = await teamService.getActiveIncident(Number(selectedTeamId));
          // Don't override if we just marked it resolved locally
          if (data?.incident?.status !== 'RESOLVED') {
             setActiveIncident(data);
          } else {
             setActiveIncident(null);
          }
        } catch (err) {
          console.error("Poll error", err);
        }
      };
      checkAssignment();
      interval = setInterval(checkAssignment, 3000); // Check every 3 seconds
    }
    return () => { if (interval) clearInterval(interval); };
  }, [selectedTeamId]);

  // 3. Track GPS if accepted
  useEffect(() => {
    let watchId: number;
    if (activeIncident?.status === 'ACCEPTED' && selectedTeamId) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLocation({ lat, lng });
            try {
              await teamService.updateTeamLocation(Number(selectedTeamId), lat, lng);
            } catch (err) {
              console.error("Failed to update location", err);
            }
          },
          (err) => setError(err.message),
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [activeIncident?.status, selectedTeamId]);

  const handleAccept = async () => {
    if (activeIncident) {
      await teamService.acceptAssignment(activeIncident.assignment_id);
      const data = await teamService.getActiveIncident(Number(selectedTeamId));
      setActiveIncident(data);
    }
  };

  const handleNeutralize = async () => {
    if (activeIncident?.incident) {
      if (window.confirm("Are you sure the threat is completely neutralized?")) {
        await incidentService.updateStatus(activeIncident.incident.id, 'RESOLVED');
        setActiveIncident(null);
        alert("Situation Neutralized! Standing by for next orders.");
      }
    }
  };

  const openNavigation = () => {
    if (activeIncident?.incident) {
      const { latitude, longitude } = activeIncident.incident;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      <header className="flex items-center space-x-3 p-4 bg-slate-950 border-b border-slate-800 z-10 shadow-lg">
        <Truck className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-lg font-bold tracking-wider">Responder App</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">AapdaNetra Live Tracking</p>
        </div>
      </header>

      {!selectedTeamId ? (
        <div className="p-6 flex-1 flex flex-col justify-center">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-center text-sm uppercase tracking-widest text-slate-400 mb-6">Device Initialization</h2>
            <select 
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            >
              <option value="">-- Select Your Unit --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>
              ))}
            </select>
          </div>
        </div>
      ) : activeIncident?.status === 'PENDING' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-red-950/30 animate-pulse">
          <div className="bg-red-600 w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(220,38,38,0.8)]">
            <BellRing className="w-16 h-16 text-white animate-bounce" />
          </div>
          <h2 className="text-3xl font-bold text-red-500 mb-2">NEW DISPATCH</h2>
          <p className="text-slate-300 text-center mb-8">Command Center has assigned you to an emergency.</p>
          
          <div className="bg-slate-800 w-full p-4 rounded-xl border border-red-500/30 mb-8">
            <div className="text-xs text-red-400 font-mono mb-1">INCIDENT TYPE</div>
            <div className="text-xl font-bold uppercase mb-4">{activeIncident.incident.title}</div>
            <div className="flex justify-between text-sm text-slate-400 font-mono">
              <span>DISTANCE: Calculating...</span>
              <span>REPORTS: {activeIncident.incident.reports}</span>
            </div>
          </div>

          <button 
            onClick={handleAccept}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-2xl text-lg tracking-wider uppercase shadow-[0_0_20px_rgba(22,163,74,0.5)] transition-all flex items-center justify-center"
          >
            <CheckCircle className="w-6 h-6 mr-2" /> ACCEPT DISPATCH
          </button>
        </div>
      ) : activeIncident?.status === 'ACCEPTED' ? (
        <div className="flex-1 flex flex-col p-6 bg-slate-900">
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6 shadow-lg flex items-center justify-between">
            <div className="flex items-center">
              <Navigation className="w-8 h-8 text-blue-500 mr-4 animate-pulse" />
              <div>
                <div className="text-blue-400 font-bold tracking-wider">LIVE TRACKING ACTIVE</div>
                <div className="text-xs text-slate-400 font-mono">Transmitting GPS to Command Center</div>
              </div>
            </div>
            <div className="bg-blue-500/10 p-2 rounded border border-blue-500/30 text-[10px] text-blue-400 animate-pulse">
              COMMAND LINKED
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl mb-6 flex-1">
            <h3 className="text-xs text-slate-500 font-mono uppercase tracking-widest border-b border-slate-700 pb-2 mb-4">Target Information</h3>
            <div className="flex items-start mb-6">
              <AlertTriangle className="w-10 h-10 text-orange-500 mr-4" />
              <div>
                <h2 className="text-xl font-bold text-white uppercase">{activeIncident.incident.title}</h2>
                <p className="text-sm text-slate-400">{activeIncident.incident.type}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase font-mono">Coordinates</div>
                <div className="font-mono text-sm text-blue-400">{activeIncident.incident.latitude.toFixed(5)}, {activeIncident.incident.longitude.toFixed(5)}</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase font-mono">Public Reports</div>
                <div className="font-mono text-sm text-white">{activeIncident.incident.reports} Citizens Affected</div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button 
              onClick={openNavigation}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center"
            >
              <MapIcon className="w-5 h-5 mr-2" /> NAVIGATE
            </button>
            <button 
              onClick={handleNeutralize}
              className="flex-1 bg-slate-800 hover:bg-green-600 border border-green-500 hover:border-transparent text-green-500 hover:text-white font-bold py-4 rounded-xl text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all flex items-center justify-center"
            >
              <ShieldCheck className="w-5 h-5 mr-2" /> NEUTRALIZE
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-6">
            <Truck className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-300 mb-2">AWAITING ORDERS</h2>
          <p className="text-sm text-slate-500">Standby. You will receive an alert here when Command Center dispatches your unit.</p>
        </div>
      )}
      {error && <div className="p-2 text-xs text-red-500 text-center bg-red-950/20">{error}</div>}
      {location && <div className="p-2 text-[10px] text-slate-500 text-center font-mono">LAT: {location.lat.toFixed(4)}, LNG: {location.lng.toFixed(4)}</div>}
    </div>
  );
}
