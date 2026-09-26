import { useState, useEffect } from 'react';
import { teamService, incidentService } from '../services/api';
import { Navigation, Truck, BellRing, CheckCircle, Map as MapIcon, AlertTriangle, ShieldCheck, RefreshCw, PlusCircle, Check } from 'lucide-react';

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

// Create custom icons for the rescuer and the target
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

export default function RescueAppPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [error, setError] = useState('');
  
  // Quick unit creation toggle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamType, setNewTeamType] = useState('RESCUE');
  const [isCreating, setIsCreating] = useState(false);

  // 1. Fetch teams & restore saved unit on load
  const fetchTeams = () => {
    teamService.getAllTeams()
      .then(data => setTeams(data))
      .catch(err => console.error("Error fetching teams", err));
  };

  useEffect(() => {
    fetchTeams();
    const savedId = localStorage.getItem('responder_team_id');
    if (savedId) {
      setSelectedTeamId(Number(savedId));
    }
  }, []);

  const handleSelectTeam = (id: number) => {
    setSelectedTeamId(id);
    localStorage.setItem('responder_team_id', String(id));
    setError('');
  };

  const handleSwitchUnit = () => {
    localStorage.removeItem('responder_team_id');
    setSelectedTeamId('');
    setActiveIncident(null);
    setError('');
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const newTeam = await teamService.registerTeam(newTeamName.trim(), newTeamType);
      handleSelectTeam(newTeam.id);
      setShowCreateModal(false);
      setNewTeamName('');
      fetchTeams();
    } catch (err: any) {
      setError("Failed to create unit. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

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
      interval = setInterval(checkAssignment, 2500); // Poll every 2.5 seconds
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
        alert("Threat Neutralized! Terminal returned to Standby mode.");
      }
    }
  };

  const openNavigation = () => {
    if (activeIncident?.incident) {
      const { latitude, longitude } = activeIncident.incident;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
    }
  };

  const currentTeam = teams.find(t => t.id === selectedTeamId);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800 z-10 shadow-lg">
        <div className="flex items-center space-x-3">
          <Truck className="w-6 h-6 text-blue-500" />
          <div>
            <h1 className="text-lg font-bold tracking-wider">Responder Terminal</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              {currentTeam ? (
                <span className="text-green-400 font-semibold">{currentTeam.name} ({currentTeam.team_type})</span>
              ) : (
                'AapdaNetra Live Dispatch'
              )}
            </p>
          </div>
        </div>

        {selectedTeamId && (
          <button 
            onClick={handleSwitchUnit}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-all cursor-pointer"
            title="Switch Unit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch Unit</span>
          </button>
        )}
      </header>

      {/* Screen 1: Select or Create Unit */}
      {!selectedTeamId ? (
        <div className="p-6 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-7 h-7 text-blue-400" />
            </div>
            
            <h2 className="text-center text-base font-bold uppercase tracking-wider text-white mb-1">
              Select Your Unit
            </h2>
            <p className="text-center text-xs text-slate-400 mb-6">
              Connect this mobile device to the Command Center
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            {!showCreateModal ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-2">AVAILABLE RESCUE TEAMS</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTeam(t.id)}
                        className="w-full text-left p-3.5 bg-slate-900 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-blue-400">{t.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">{t.team_type}</div>
                        </div>
                        <span className="text-xs bg-slate-800 group-hover:bg-blue-600 text-slate-300 group-hover:text-white px-2.5 py-1 rounded-md font-mono">
                          Connect
                        </span>
                      </button>
                    ))}
                    {teams.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500 font-mono">
                        Loading teams from Command Center...
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-blue-400" />
                    <span>Create New Unit</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuickCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">NEW UNIT NAME</label>
                  <input 
                    type="text" 
                    placeholder="e.g. NDRF Quick Reaction Team" 
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">UNIT TYPE</label>
                  <select 
                    value={newTeamType}
                    onChange={e => setNewTeamType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  >
                    <option value="RESCUE">RESCUE SQUAD (NDRF/SDRF)</option>
                    <option value="MEDICAL">MEDICAL / AMBULANCE</option>
                    <option value="FIRE">FIRE BRIGADE</option>
                    <option value="POLICE">POLICE PATROL</option>
                  </select>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCreating}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isCreating ? "Creating..." : "Save & Connect"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : activeIncident?.status === 'PENDING' ? (
        /* Screen 2: Incoming Dispatch Alarm (Ola Style) */
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
              <span>STATUS: Immediate Priority</span>
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
        /* Screen 3: Live Ola Map Route & Mission View */
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
                    {/* Simulated Ola Directions API Polyline */}
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
        /* Screen 4: Standby Mode */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-6">
            <Truck className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-300 mb-2">AWAITING ORDERS</h2>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            Standby. You will receive an alert here as soon as Command Center dispatches your unit.
          </p>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Uplink Active: {currentTeam?.name || 'Unit Connected'}</span>
          </div>
        </div>
      )}

      {location && selectedTeamId && (
        <div className="p-2 text-[10px] text-slate-500 text-center font-mono">
          GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
      )}
    </div>
  );
}
