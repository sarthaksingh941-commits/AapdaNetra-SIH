import { useState, useEffect } from 'react';
import { teamService, incidentService } from '../services/api';
import { Navigation, Truck, BellRing, CheckCircle, Map as MapIcon, AlertTriangle, ShieldCheck, RefreshCw, Radio, Loader2, Power, PowerOff, ShieldAlert } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
const rescuerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const targetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const QUICK_PRESETS = [
  { name: "NDRF Alpha", type: "RESCUE" },
  { name: "State Medical Response", type: "MEDICAL" },
  { name: "Delhi Fire Service", type: "FIRE" },
  { name: "Police Patrol Unit 1", type: "POLICE" }
];

export default function RescueAppPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [teamName, setTeamName] = useState('');
  const [teamType, setTeamType] = useState('RESCUE');
  const [isOnDuty, setIsOnDuty] = useState(true);
  
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  // 1. Restore saved team & duty status on load
  useEffect(() => {
    const savedId = localStorage.getItem('responder_team_id');
    const savedName = localStorage.getItem('responder_team_name');
    const savedType = localStorage.getItem('responder_team_type');
    const savedDuty = localStorage.getItem('responder_duty');
    
    if (savedId && savedName) {
      setSelectedTeamId(Number(savedId));
      setTeamName(savedName);
      if (savedType) setTeamType(savedType);
    }
    if (savedDuty !== null) {
      setIsOnDuty(savedDuty === 'true');
    }
  }, []);

  // 2. Connect / Set Unit Name
  const handleConnect = async (e?: React.FormEvent, customName?: string, customType?: string) => {
    if (e) e.preventDefault();
    const finalName = (customName || teamName).trim();
    const finalType = customType || teamType;

    if (!finalName) {
      setError("Please enter your name or unit title");
      return;
    }

    setIsConnecting(true);
    setError('');

    let teamId: number = Date.now();

    try {
      const team = await teamService.registerTeam(finalName, finalType);
      if (team && team.id) {
        teamId = team.id;
      }
    } catch (err: any) {
      console.warn("Backend register notice, establishing instant uplink session:", err);
    }

    setSelectedTeamId(teamId);
    setTeamName(finalName);
    setTeamType(finalType);
    setIsOnDuty(true);

    localStorage.setItem('responder_team_id', String(teamId));
    localStorage.setItem('responder_team_name', finalName);
    localStorage.setItem('responder_team_type', finalType);
    localStorage.setItem('responder_duty', 'true');

    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('responder_team_id');
    localStorage.removeItem('responder_team_name');
    localStorage.removeItem('responder_team_type');
    setSelectedTeamId('');
    setActiveIncident(null);
    setError('');
  };

  const toggleDutyStatus = async () => {
    const nextDuty = !isOnDuty;
    setIsOnDuty(nextDuty);
    localStorage.setItem('responder_duty', String(nextDuty));

    if (selectedTeamId) {
      try {
        await teamService.updateTeamStatus(Number(selectedTeamId), nextDuty ? 'AVAILABLE' : 'OFF_DUTY');
      } catch (e) {
        console.warn("Duty status update error:", e);
      }
    }
  };

  // 3. Continuously send GPS location ONLY when ON DUTY
  useEffect(() => {
    let watchId: number;
    if (selectedTeamId && isOnDuty && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          try {
            await teamService.updateTeamLocation(Number(selectedTeamId), lat, lng);
          } catch (err) {
            console.error("Failed to transmit GPS coordinates:", err);
          }
        },
        (err) => {
          console.warn("GPS error:", err.message);
          setError("GPS access needed: Please allow location in browser settings.");
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [selectedTeamId, isOnDuty]);

  // 4. Poll for dispatches from Command Center ONLY when ON DUTY
  useEffect(() => {
    let interval: any;
    if (selectedTeamId && isOnDuty) {
      const checkAssignment = async () => {
        try {
          const data = await teamService.getActiveIncident(Number(selectedTeamId));
          if (data?.incident?.status !== 'RESOLVED') {
            setActiveIncident(data);
          } else {
            setActiveIncident(null);
          }
        } catch (err) {
          console.error("Assignment poll error:", err);
        }
      };
      checkAssignment();
      interval = setInterval(checkAssignment, 2000); // 2 second check
    } else {
      setActiveIncident(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTeamId, isOnDuty]);

  const handleAccept = async () => {
    if (activeIncident) {
      await teamService.acceptAssignment(activeIncident.assignment_id);
      const data = await teamService.getActiveIncident(Number(selectedTeamId));
      setActiveIncident(data);
    }
  };

  const handleNeutralize = async () => {
    if (activeIncident?.incident) {
      if (window.confirm("Are you sure this threat is completely neutralized?")) {
        await incidentService.updateStatus(activeIncident.incident.id, 'RESOLVED');
        setActiveIncident(null);
        alert("Mission Accomplished! Emergency marked RESOLVED on Command Center.");
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
      {/* Top Header */}
      <header className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800 z-10 shadow-lg">
        <div className="flex items-center space-x-3">
          <Truck className="w-6 h-6 text-blue-500" />
          <div>
            <h1 className="text-lg font-bold tracking-wider">Responder Terminal</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              {selectedTeamId ? (
                <span className="text-green-400 font-semibold">{teamName}</span>
              ) : (
                'AapdaNetra Live Dispatch'
              )}
            </p>
          </div>
        </div>

        {selectedTeamId && (
          <div className="flex items-center space-x-2">
            {/* On / Off Duty Toggle Button */}
            <button 
              onClick={toggleDutyStatus}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                isOnDuty 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
              }`}
              title={isOnDuty ? "Click to go Off Duty" : "Click to go On Duty"}
            >
              <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
              <span>{isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</span>
            </button>

            {/* Switch Unit Button */}
            <button 
              onClick={handleDisconnect}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-all cursor-pointer"
              title="Change Responder Name"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Change</span>
            </button>
          </div>
        )}
      </header>

      {/* Screen 1: Set Responder Name */}
      {!selectedTeamId ? (
        <div className="p-6 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Radio className="w-7 h-7 text-blue-400 animate-pulse" />
            </div>
            
            <h2 className="text-center text-lg font-bold uppercase tracking-wider text-white mb-1">
              Initialize Responder Unit
            </h2>
            <p className="text-center text-xs text-slate-400 mb-6">
              Enter your name or unit title to appear on the Command Center map
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">RESPONDER / UNIT NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. Sarthak - NDRF Alpha" 
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">VEHICLE / SQUAD TYPE</label>
                <select 
                  value={teamType}
                  onChange={e => setTeamType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                >
                  <option value="RESCUE">🚚 RESCUE SQUAD (NDRF/SDRF)</option>
                  <option value="MEDICAL">🚑 MEDICAL / AMBULANCE</option>
                  <option value="FIRE">🚒 FIRE BRIGADE</option>
                  <option value="POLICE">🚓 POLICE PATROL</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5">OR TAP A QUICK PRESET:</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleConnect(undefined, preset.name, preset.type)}
                      className="p-2 bg-slate-900 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500 rounded-lg text-left transition-all cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-slate-200 truncate">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{preset.type}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isConnecting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer mt-4"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>CONNECTING UPLINK...</span>
                  </>
                ) : (
                  <span>START LIVE UPLINK</span>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : !isOnDuty ? (
        /* Screen 1.5: Off Duty Paused Mode */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
          <div className="w-24 h-24 rounded-full bg-slate-800/80 border-4 border-red-500/40 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="w-12 h-12 text-red-400" />
          </div>
          <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-mono uppercase tracking-widest mb-3">
            Status: Offline
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">YOU ARE OFF DUTY</h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Your vehicle is hidden from the Command Center map. Emergency requests and live GPS tracking are currently suspended.
          </p>

          <button
            onClick={toggleDutyStatus}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer text-base uppercase tracking-wider"
          >
            <Power className="w-5 h-5" />
            <span>GO ON DUTY</span>
          </button>
        </div>
      ) : activeIncident?.status === 'PENDING' ? (
        /* Screen 2: Incoming Dispatch Alert */
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-red-950/30 animate-pulse">
          <div className="bg-red-600 w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(220,38,38,0.8)]">
            <BellRing className="w-16 h-16 text-white animate-bounce" />
          </div>
          <h2 className="text-3xl font-bold text-red-500 mb-2">NEW DISPATCH</h2>
          <p className="text-slate-300 text-center mb-8">Command Center has assigned an emergency to your unit.</p>
          
          <div className="bg-slate-800 w-full p-4 rounded-xl border border-red-500/30 mb-8 max-w-md">
            <div className="text-xs text-red-400 font-mono mb-1">INCIDENT TYPE</div>
            <div className="text-xl font-bold uppercase mb-4">{activeIncident.incident.title}</div>
            <div className="flex justify-between text-sm text-slate-400 font-mono">
              <span>PRIORITY: Critical</span>
              <span>REPORTS: {activeIncident.incident.reports} Citizens</span>
            </div>
          </div>

          <button 
            onClick={handleAccept}
            className="w-full max-w-md bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-2xl text-lg tracking-wider uppercase shadow-[0_0_20px_rgba(22,163,74,0.5)] transition-all flex items-center justify-center cursor-pointer"
          >
            <CheckCircle className="w-6 h-6 mr-2" /> ACCEPT DISPATCH
          </button>
        </div>
      ) : activeIncident?.status === 'ACCEPTED' ? (
        /* Screen 3: Ola Maps Route & Mission Active */
        <div className="flex-1 flex flex-col p-6 bg-slate-900 max-w-md mx-auto w-full">
          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6 shadow-lg flex items-center justify-between">
            <div className="flex items-center">
              <Navigation className="w-8 h-8 text-blue-500 mr-4 animate-pulse" />
              <div>
                <div className="text-blue-400 font-bold tracking-wider text-sm">LIVE TRACKING ACTIVE</div>
                <div className="text-[11px] text-slate-400 font-mono">Transmitting GPS to Command Center</div>
              </div>
            </div>
            <div className="bg-blue-500/10 p-2 rounded border border-blue-500/30 text-[10px] text-blue-400 animate-pulse">
              COMMAND LINKED
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl mb-6 flex-1">
            <h3 className="text-xs text-slate-500 font-mono uppercase tracking-widest border-b border-slate-700 pb-2 mb-4">Target Information</h3>
            <div className="flex items-start mb-6">
              <AlertTriangle className="w-10 h-10 text-orange-500 mr-4 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white uppercase">{activeIncident.incident.title}</h2>
                <p className="text-sm text-slate-400">{activeIncident.incident.type}</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-1 flex flex-col">
              {location ? (
                <div className="w-full rounded-xl overflow-hidden border border-slate-700 shadow-[0_0_15px_rgba(59,130,246,0.2)] relative" style={{ height: '350px' }}>
                  <MapContainer 
                    center={[location.lat, location.lng]} 
                    zoom={14} 
                    style={{ height: '100%', width: '100%', zIndex: 0 }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://olamaps.com">Ola Maps</a>'
                      url="https://api.olamaps.io/tiles/vector/v1/styles/default-dark-standard/{z}/{x}/{y}.png?api_key=IB2tQ5BHYCHBv1ntHCKfBROOOI5Sr4mI6nAB8CUu"
                      className="map-tiles-dark"
                    />
                    <Marker position={[location.lat, location.lng]} icon={rescuerIcon} />
                    <Marker position={[activeIncident.incident.latitude, activeIncident.incident.longitude]} icon={targetIcon} />
                    <Polyline 
                      positions={[
                        [location.lat, location.lng],
                        [activeIncident.incident.latitude, activeIncident.incident.longitude]
                      ]}
                      pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '10, 10' }}
                    />
                  </MapContainer>
                  <div className="absolute top-2 left-2 bg-slate-900/80 p-1.5 rounded text-[8px] font-mono border border-slate-700 text-blue-400 z-[1000] backdrop-blur-md uppercase">
                    POWERED BY OLA MAPS DIRECTION API
                  </div>
                </div>
              ) : (
                <div className="w-full h-48 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center font-mono text-xs text-slate-500">
                  Awaiting GPS Lock...
                </div>
              )}
              
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase font-mono">Public Reports</div>
                <div className="font-mono text-sm text-white">{activeIncident.incident.reports} Citizens Affected</div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button 
              onClick={openNavigation}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center cursor-pointer"
            >
              <MapIcon className="w-5 h-5 mr-2" /> NAVIGATE
            </button>
            <button 
              onClick={handleNeutralize}
              className="flex-1 bg-slate-800 hover:bg-green-600 border border-green-500 hover:border-transparent text-green-500 hover:text-white font-bold py-4 rounded-xl text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all flex items-center justify-center cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5 mr-2" /> NEUTRALIZE
            </button>
          </div>
        </div>
      ) : (
        /* Screen 4: Standby Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-6">
            <Truck className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-300 mb-2">AWAITING ORDERS</h2>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            Standby. You will receive an alert here as soon as Command Center dispatches your unit.
          </p>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-mono mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Uplink Active: {teamName}</span>
          </div>

          <div>
            <button 
              onClick={toggleDutyStatus}
              className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 bg-slate-800/80 px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer mx-auto"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Go Off Duty</span>
            </button>
          </div>
        </div>
      )}

      {/* GPS Status footer */}
      {location && selectedTeamId && isOnDuty && (
        <div className="p-2 text-[10px] text-slate-500 text-center font-mono">
          GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} • Transmitting Live
        </div>
      )}
    </div>
  );
}
