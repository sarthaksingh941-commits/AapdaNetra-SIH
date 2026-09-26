import { useState, useEffect } from 'react';
import { teamService, incidentService } from '../services/api';
import { Navigation, Truck, BellRing, CheckCircle, Map as MapIcon, AlertTriangle, ShieldCheck, RefreshCw, Radio, Loader2, Power, PowerOff, ShieldAlert, Compass } from 'lucide-react';

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

    try {
      const initialTelemetry = {
        id: teamId,
        name: finalName,
        team_type: finalType,
        status: 'AVAILABLE',
        latitude: location?.lat || 28.6139,
        longitude: location?.lng || 77.2090,
        updatedAt: Date.now()
      };
      localStorage.setItem('live_responder_telemetry', JSON.stringify(initialTelemetry));
    } catch (e) {}

    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('responder_team_id');
    localStorage.removeItem('responder_team_name');
    localStorage.removeItem('responder_team_type');
    localStorage.removeItem('live_responder_telemetry');
    setSelectedTeamId('');
    setActiveIncident(null);
    setError('');
  };

  const toggleDutyStatus = async () => {
    const nextDuty = !isOnDuty;
    setIsOnDuty(nextDuty);
    localStorage.setItem('responder_duty', String(nextDuty));

    try {
      const cur = JSON.parse(localStorage.getItem('live_responder_telemetry') || '{}');
      cur.status = nextDuty ? 'AVAILABLE' : 'OFF_DUTY';
      localStorage.setItem('live_responder_telemetry', JSON.stringify(cur));
    } catch (e) {}

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

          // Broadcast locally for instant zero-lag Command Center sync
          try {
            const telemetry = {
              id: selectedTeamId,
              name: teamName,
              team_type: teamType,
              status: isOnDuty ? 'AVAILABLE' : 'OFF_DUTY',
              latitude: lat,
              longitude: lng,
              updatedAt: Date.now()
            };
            localStorage.setItem('live_responder_telemetry', JSON.stringify(telemetry));
          } catch (e) {}

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
      interval = setInterval(checkAssignment, 2000);
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Responsive Top Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/90 border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-wider">Responder Terminal</h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400 uppercase">
                  Mobile / Tab Field Unit
                </span>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate max-w-[200px] sm:max-w-xs">
                {selectedTeamId ? (
                  <span className="text-green-400 font-semibold">{teamName} ({teamType})</span>
                ) : (
                  'AapdaNetra Live Dispatch'
                )}
              </p>
            </div>
          </div>

          {selectedTeamId && (
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* On / Off Duty Toggle Button */}
              <button 
                onClick={toggleDutyStatus}
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isOnDuty 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' 
                    : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                }`}
                title={isOnDuty ? "Click to go Off Duty" : "Click to go On Duty"}
              >
                <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
                <span className="tracking-wide">{isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</span>
              </button>

              {/* Switch Unit Button */}
              <button 
                onClick={handleDisconnect}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/80 transition-all cursor-pointer"
                title="Change Unit / Re-initialize"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Change</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area - Fluid Mobile & Tablet Frame */}
      <main className="flex-1 flex flex-col justify-center p-3 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
        {/* Screen 1: Set Responder Name */}
        {!selectedTeamId ? (
          <div className="w-full max-w-md sm:max-w-lg mx-auto">
            <div className="bg-slate-900/90 border border-slate-800 p-5 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400 animate-pulse" />
              </div>
              
              <h2 className="text-center text-lg sm:text-xl font-bold uppercase tracking-wider text-white mb-1.5">
                Initialize Field Unit
              </h2>
              <p className="text-center text-xs sm:text-sm text-slate-400 mb-6">
                Optimized for Mobile & Tablet Tactical Displays
              </p>

              {error && (
                <div className="mb-5 p-3.5 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-400 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleConnect} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">RESPONDER / UNIT NAME</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Sarthak - NDRF Alpha" 
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">VEHICLE / SQUAD TYPE</label>
                  <select 
                    value={teamType}
                    onChange={e => setTeamType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  >
                    <option value="RESCUE">🚚 RESCUE SQUAD (NDRF/SDRF)</option>
                    <option value="MEDICAL">🚑 MEDICAL / AMBULANCE</option>
                    <option value="FIRE">🚒 FIRE BRIGADE</option>
                    <option value="POLICE">🚓 POLICE PATROL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-2">QUICK PRESETS (TAP TO CONNECT):</label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                    {QUICK_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleConnect(undefined, preset.name, preset.type)}
                        className="p-2.5 sm:p-3 bg-slate-950 hover:bg-blue-600/20 border border-slate-800 hover:border-blue-500/80 rounded-xl text-left transition-all cursor-pointer group"
                      >
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 truncate">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{preset.type}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isConnecting}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 sm:py-4.5 rounded-2xl shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer mt-5 text-sm sm:text-base uppercase tracking-wider"
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md sm:max-w-lg mx-auto w-full">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 border-2 border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
              <ShieldAlert className="w-12 h-12 sm:w-14 sm:h-14 text-red-400" />
            </div>
            <div className="inline-block px-3.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-mono uppercase tracking-widest mb-3">
              Status: Offline
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">YOU ARE OFF DUTY</h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-8 max-w-sm leading-relaxed">
              Your vehicle is hidden from the Command Center map. Emergency requests and live GPS tracking are currently suspended.
            </p>

            <button
              onClick={toggleDutyStatus}
              className="w-full max-w-xs sm:max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer text-sm sm:text-base uppercase tracking-wider"
            >
              <Power className="w-5 h-5" />
              <span>GO ON DUTY</span>
            </button>
          </div>
        ) : activeIncident?.status === 'PENDING' ? (
          /* Screen 2: Incoming Dispatch Alert */
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center max-w-lg mx-auto w-full">
            <div className="bg-red-600 w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(220,38,38,0.8)] animate-pulse">
              <BellRing className="w-14 h-14 sm:w-18 sm:h-18 text-white animate-bounce" />
            </div>
            
            <div className="inline-block px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-xs font-mono uppercase tracking-widest mb-2 animate-pulse">
              🚨 Emergency Alert Received
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-extrabold text-red-500 tracking-wider mb-2">NEW DISPATCH</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-6">
              Command Center has assigned a high-priority incident to your unit.
            </p>
            
            <div className="bg-slate-900 border border-red-500/40 w-full p-5 sm:p-6 rounded-3xl shadow-xl mb-6 text-left">
              <div className="text-[11px] text-red-400 font-mono uppercase tracking-wider mb-1">INCIDENT TITLE</div>
              <div className="text-lg sm:text-xl font-bold uppercase text-white mb-4">{activeIncident.incident.title}</div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">CATEGORY</span>
                  <span className="text-orange-400 font-semibold">{activeIncident.incident.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CITIZENS AFFECTED</span>
                  <span className="text-white font-semibold">{activeIncident.incident.reports} Reports</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleAccept}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4.5 sm:py-5 rounded-2xl text-base sm:text-lg tracking-wider uppercase shadow-[0_0_30px_rgba(22,163,74,0.6)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle className="w-6 h-6" />
              <span>ACCEPT DISPATCH</span>
            </button>
          </div>
        ) : activeIncident?.status === 'ACCEPTED' ? (
          /* Screen 3: Ola Maps Route & Mission Active (Adaptive Mobile & Tablet Split) */
          <div className="w-full flex-1 flex flex-col space-y-4">
            {/* Top Tactical Banner */}
            <div className="bg-blue-950/40 border border-blue-500/30 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center space-x-3">
                <Navigation className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 animate-pulse shrink-0" />
                <div>
                  <div className="text-blue-400 font-bold tracking-wider text-xs sm:text-sm">LIVE MISSION ACTIVE</div>
                  <div className="text-[10px] sm:text-xs text-slate-400 font-mono">Transmitting telemetry to Command Center</div>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-[10px] font-mono text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                <span>LINKED</span>
              </div>
            </div>

            {/* Responsive Split Container: 1 Col on Mobile, 2 Col on Tablet (md:) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
              {/* Left Column: Target Information & Action Buttons (Mobile: Top / Tablet: Left 5 cols) */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">TARGET DISASTER</div>
                      <h2 className="text-lg sm:text-xl font-bold text-white uppercase leading-tight">{activeIncident.incident.title}</h2>
                      <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-orange-400 font-mono">
                        {activeIncident.incident.type}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase font-mono">Latitude</div>
                      <div className="font-mono text-xs sm:text-sm text-blue-400 font-semibold">{activeIncident.incident.latitude.toFixed(4)}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase font-mono">Longitude</div>
                      <div className="font-mono text-xs sm:text-sm text-blue-400 font-semibold">{activeIncident.incident.longitude.toFixed(4)}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-mono">CITIZEN CASUALTIES / REPORTS</div>
                      <div className="font-mono text-sm sm:text-base font-bold text-white">{activeIncident.incident.reports} Citizens Affected</div>
                    </div>
                    <Compass className="w-5 h-5 text-slate-500" />
                  </div>
                </div>

                {/* Tactical Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button 
                    onClick={openNavigation}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <MapIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>NAVIGATE</span>
                  </button>
                  <button 
                    onClick={handleNeutralize}
                    className="bg-slate-900 hover:bg-green-600 border border-green-500/80 hover:border-transparent text-green-400 hover:text-white font-bold py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>NEUTRALIZE</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Full Responsive Ola Map (Mobile: 300px / Tablet: 480px) */}
              <div className="md:col-span-7 flex flex-col">
                <div className="w-full flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative min-h-[300px] sm:min-h-[380px] md:min-h-[480px]">
                  {location ? (
                    <MapContainer 
                      center={[location.lat, location.lng]} 
                      zoom={14} 
                      style={{ height: '100%', width: '100%', minHeight: '300px' }}
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
                  ) : (
                    <div className="w-full h-full min-h-[300px] bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                      <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">Awaiting GPS Lock...</div>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-mono border border-slate-800 text-blue-400 z-[1000] uppercase tracking-wider">
                    OLA MAPS ROUTING API
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Screen 4: Standby Screen (Awaiting Orders) */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md sm:max-w-lg mx-auto w-full">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center mb-6 shadow-2xl">
              <Truck className="w-10 h-10 sm:w-12 sm:h-12 text-slate-500" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-slate-200 tracking-wider mb-2">AWAITING ORDERS</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">
              Standby mode active. You will receive an immediate dispatch alert here as soon as Command Center routes an emergency to your unit.
            </p>
            
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-mono mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Uplink Active: {teamName}</span>
            </div>

            <div>
              <button 
                onClick={toggleDutyStatus}
                className="text-xs text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/40 bg-slate-900 px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer mx-auto"
              >
                <PowerOff className="w-3.5 h-3.5 text-red-400" />
                <span>Go Off Duty</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* GPS Status Footer Bar */}
      {location && selectedTeamId && isOnDuty && (
        <footer className="py-2.5 px-4 bg-slate-950 border-t border-slate-800/80 text-[10px] sm:text-xs text-slate-400 text-center font-mono flex items-center justify-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>LAT: {location.lat.toFixed(5)}</span>
          <span className="text-slate-600">•</span>
          <span>LNG: {location.lng.toFixed(5)}</span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-emerald-400 hidden sm:inline">Telemetry Transmitting Live</span>
        </footer>
      )}
    </div>
  );
}
