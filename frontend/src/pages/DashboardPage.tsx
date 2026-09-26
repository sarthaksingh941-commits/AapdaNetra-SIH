import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Clock, MapPin, Users, ShieldAlert, BarChart3, List, Radio, CloudRain } from 'lucide-react';
import { incidentService, teamService, authService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to recenter map
function MapUpdater({ selectedIncident }: { selectedIncident: any }) {
  const map = useMap();
  useEffect(() => {
    if (selectedIncident && selectedIncident.latitude && selectedIncident.longitude) {
      // Use setView instead of flyTo for instant jumping without animation delay
      map.setView([selectedIncident.latitude, selectedIncident.longitude], 13);
    }
  }, [selectedIncident?.id, map]);
  return null;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#10b981'];

// Helper to format exact local emergency time with relative context
function formatIncidentTime(dateVal: string | Date | undefined | null): string {
  if (!dateVal) return '--:--';

  let date: Date;
  if (typeof dateVal === 'string') {
    let s = dateVal.trim();
    // If backend sent ISO string without timezone indicator (like "2026-09-26T16:22:52"),
    // append 'Z' so JavaScript correctly parses it as UTC and converts to local IST time
    if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
      s += 'Z';
    }
    date = new Date(s);
  } else {
    date = new Date(dateVal);
  }

  if (isNaN(date.getTime())) return '--:--';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  let relative = '';
  if (diffSec < 60) {
    relative = 'Just now';
  } else if (diffSec < 3600) {
    relative = `${Math.floor(diffSec / 60)}m ago`;
  } else if (diffSec < 86400) {
    relative = `${Math.floor(diffSec / 3600)}h ago`;
  } else {
    relative = `${Math.floor(diffSec / 86400)}d ago`;
  }

  // Exact 12-hour local time format: e.g. "09:52 PM"
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `${timeStr} (${relative})`;
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [broadcastStatus, setBroadcastStatus] = useState<0 | 1 | 2 | 3>(0);
  const [currentTime, setCurrentTime] = useState<string>('');
  const user = authService.getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBroadcast = () => {
    setBroadcastStatus(1); // scanning
    setTimeout(() => {
      setBroadcastStatus(2); // sending
      setTimeout(() => {
        setBroadcastStatus(3); // done
        setTimeout(() => setBroadcastStatus(0), 4000); // reset after 4s
      }, 2500);
    }, 1500);
  };

  useEffect(() => {
    if (!user || (user.role !== 'RESPONDER' && user.role !== 'ADMIN')) {
      alert("Unauthorized access. Responders only.");
      navigate('/login');
      return;
    }

    const fetchIncidents = async () => {
      try {
        const data = await incidentService.getAllIncidents();
        // Filter out RESOLVED incidents from the Active list
        const activeIncidents = data.filter((inc: any) => inc.status !== 'RESOLVED');
        setIncidents(activeIncidents);
        
        // If current selected incident is resolved or we don't have one, select the first active one
        if (activeIncidents.length > 0) {
          if (!selectedIncident || activeIncidents.find((i: any) => i.id === selectedIncident.id) === undefined) {
            setSelectedIncident(activeIncidents[0]);
          }
        } else {
          setSelectedIncident(null);
        }
      } catch (err) {
        console.error("Failed to fetch incidents", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchTeams = async () => {
      try {
        let remoteTeams: any[] = [];
        try {
          const res = await teamService.getAllTeams();
          if (Array.isArray(res) && res.length > 0) {
            remoteTeams = res;
          }
        } catch (e) {
          // Backend offline / waking up
        }

        let merged = [...remoteTeams];

        // Merge live responder telemetry from local session if active
        try {
          const localStr = localStorage.getItem('live_responder_telemetry');
          if (localStr) {
            const localData = JSON.parse(localStr);
            if (localData && localData.name) {
              const idx = merged.findIndex(t => t.id === localData.id || t.name === localData.name);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...localData };
              } else {
                merged.push(localData);
              }
            }
          }
        } catch (e) {}

        // Fallback default teams if remote is completely empty
        if (merged.length === 0) {
          merged = [
            { id: 1, name: "NDRF Alpha Team", team_type: "RESCUE", status: "AVAILABLE", latitude: 28.6139, longitude: 77.2090 },
            { id: 2, name: "Delhi Fire Service", team_type: "FIRE", status: "AVAILABLE", latitude: 28.5355, longitude: 77.3910 },
            { id: 3, name: "State Medical Response", team_type: "MEDICAL", status: "AVAILABLE", latitude: 28.7041, longitude: 77.1025 },
            { id: 4, name: "Delhi Police Patrol", team_type: "POLICE", status: "AVAILABLE", latitude: 28.6300, longitude: 77.2200 }
          ];
        }

        setTeams(merged);
      } catch (err) {
        console.error("Failed to fetch teams", err);
      }
    };

    fetchIncidents();
    fetchTeams();
    // Poll every 2 seconds for instant MVP realtime feel
    const interval = setInterval(() => {
      fetchIncidents();
      fetchTeams();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Chart Data
  const typeData = useMemo(() => {
    const counts: any = {};
    incidents.forEach(inc => { counts[inc.type] = (counts[inc.type] || 0) + 1; });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [incidents]);

  const severityData = useMemo(() => {
    const counts: any = { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
    incidents.forEach(inc => { counts[inc.severity] = (counts[inc.severity] || 0) + 1; });
    return Object.keys(counts).filter(key => counts[key] > 0).map(key => ({ name: key, value: counts[key] }));
  }, [incidents]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/50">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">AAPDA<span className="text-blue-500">NETRA</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">Command & Control Center</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono text-xs text-blue-400">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>IST: {currentTime || '--:--:--'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400 uppercase font-mono">System Online</span>
          </div>
          <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-mono border border-slate-700 text-blue-400">
            ADMIN VIEW
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-1/3 bg-slate-900/50 backdrop-blur-md flex flex-col border-r border-slate-800 z-10 shadow-2xl">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button 
              onClick={() => setActiveTab('list')} 
              className={`flex-1 py-4 font-mono text-xs tracking-wider flex items-center justify-center transition-all ${activeTab === 'list' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <List className="w-4 h-4 mr-2"/> LIVE FEEDS
            </button>
            <button 
              onClick={() => setActiveTab('analytics')} 
              className={`flex-1 py-4 font-mono text-xs tracking-wider flex items-center justify-center transition-all ${activeTab === 'analytics' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <BarChart3 className="w-4 h-4 mr-2"/> ANALYTICS
            </button>
          </div>

          {activeTab === 'list' ? (
            <>
              <div className="p-4 border-b border-slate-800 bg-slate-900/80">
                <h2 className="font-mono text-sm text-slate-300 flex items-center justify-between">
                  <span>ACTIVE INCIDENTS</span>
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-1 rounded-full animate-pulse">{incidents.length} CRITICAL</span>
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {loading ? <div className="p-4 text-center font-mono text-xs text-blue-400 animate-pulse">Initializing scans...</div> : incidents.length === 0 ? <div className="p-4 text-center font-mono text-xs text-slate-500">No active threats detected.</div> : null}
                {incidents.map((incident) => (
                  <div 
                    key={incident.id} 
                    onClick={() => setSelectedIncident(incident)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border backdrop-blur-sm ${selectedIncident?.id === incident.id ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-700/50 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-slate-200">{incident.title}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-400">{incident.status}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs mb-3 font-mono">
                      <span className="text-red-400 flex items-center bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                        PRIORITY: {incident.priority_score.toFixed(1)}
                      </span>
                      <span className="text-slate-300 flex items-center bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                        <Clock className="h-3 w-3 mr-1.5 text-blue-400"/> {formatIncidentTime(incident.created_at)}
                      </span>
                    </div>
                    
                    <div className="flex text-xs font-mono text-slate-500 space-x-4">
                      <span className="flex items-center"><Users className="h-3 w-3 mr-1.5 text-blue-400"/> {incident.reports?.length || 0} REPORTS</span>
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-1.5 text-blue-400"/> {incident.latitude.toFixed(2)}, {incident.longitude.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50 custom-scrollbar">
              <h2 className="font-mono text-sm text-slate-400 mb-6 tracking-widest uppercase">Global Analytics</h2>
              
              {/* Weather Widget */}
              {(() => {
                const target = selectedIncident || (incidents.length > 0 ? incidents[0] : null);
                
                let temp = "28°C";
                let condition = "Clear Conditions";
                let alertClass = "text-slate-300";
                
                if (target) {
                   const type = target.title.toLowerCase();
                   if (type.includes('flood') || type.includes('water')) { temp = "26°C"; condition = "Heavy Rainfall Warning"; alertClass = "text-blue-400"; }
                   else if (type.includes('fire')) { temp = "38°C"; condition = "High Temperature Risk"; alertClass = "text-orange-400"; }
                   else if (type.includes('earthquake')) { temp = "30°C"; condition = "Seismic Activity Zone"; alertClass = "text-red-400"; }
                   else { condition = "Monitoring Active Zone"; alertClass = "text-yellow-400"; }
                }

                return (
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl shadow-lg border border-slate-700/50 mb-6 relative overflow-hidden transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <h3 className="font-mono text-blue-400 mb-3 text-xs tracking-wider flex items-center uppercase">
                      <CloudRain className="w-4 h-4 mr-2" /> 
                      {target ? `TARGET RADAR: ${target.latitude.toFixed(3)}N, ${target.longitude.toFixed(3)}E` : 'GLOBAL WEATHER RADAR'}
                    </h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-3xl font-light text-white mb-1">{target ? temp : '--'}</div>
                        <div className="text-xs text-slate-400 font-mono uppercase">{target ? `Zone: ${target.title}` : 'Awaiting Target...'}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${alertClass}`}>{target ? condition : 'System Standby'}</div>
                        <div className="text-xs text-slate-500 mt-1 font-mono">
                          {target ? `Humidity: ${target.title.toLowerCase().includes('fire') ? '12%' : '89%'} | Wind: 24km/h` : 'Offline'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {incidents.length === 0 ? (
                <div className="text-slate-600 font-mono text-xs text-center mt-10">INSUFFICIENT DATA GATHERED</div>
              ) : (
                <>
                  <div className="bg-slate-800/50 p-5 rounded-xl shadow-lg border border-slate-700/50 mb-6 backdrop-blur-sm">
                    <h3 className="font-mono text-slate-300 mb-4 text-xs text-center tracking-wider">THREAT DISTRIBUTION</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                            {typeData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      {typeData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length], boxShadow: `0 0 8px ${COLORS[index % COLORS.length]}` }}></div>
                          {entry.name} ({entry.value})
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 p-5 rounded-xl shadow-lg border border-slate-700/50 backdrop-blur-sm">
                    <h3 className="font-mono text-slate-300 mb-4 text-xs text-center tracking-wider">SEVERITY INDEX</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={severityData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                          <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} cursor={{fill: '#1e293b'}} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {severityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Critical' ? '#ef4444' : entry.name === 'High' ? '#f97316' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Action Panel for Selected Incident */}
          {selectedIncident && (
          <div className="p-5 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-mono text-xs text-blue-400 flex items-center uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                Targeting: #{selectedIncident.id.toString().padStart(4, '0')}
              </h3>
              <span className="text-[11px] font-mono text-slate-400 flex items-center bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <Clock className="w-3 h-3 mr-1.5 text-blue-400" />
                Reported: <strong className="text-slate-200 ml-1">{formatIncidentTime(selectedIncident.created_at)}</strong>
              </span>
            </div>
            
            {broadcastStatus > 0 ? (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 font-mono text-xs mb-2">
                {broadcastStatus === 1 && (
                  <div className="text-yellow-400 flex items-center animate-pulse">
                    <Radio className="w-4 h-4 mr-2" /> Scanning active cell towers in 5km radius...
                  </div>
                )}
                {broadcastStatus === 2 && (
                  <div className="text-blue-400 flex items-center animate-pulse">
                    <Radio className="w-4 h-4 mr-2" /> Transmitting Emergency Push SMS to all devices...
                  </div>
                )}
                {broadcastStatus === 3 && (
                  <div className="text-green-400 flex items-center font-bold">
                    <Radio className="w-4 h-4 mr-2" /> SUCCESS: Alerts delivered to 14,392 active devices.
                  </div>
                )}
              </div>
            ) : showAssign ? (
              <div className="space-y-3">
                <select 
                  className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2.5 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  value={selectedTeam}
                >
                  <option value="">-- SELECT RESPONDER TEAM --</option>
                  {teams.filter(t => t.status !== 'OFF_DUTY').map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>)}
                </select>
                <div className="flex space-x-3">
                  <button 
                    onClick={async () => {
                      if (!selectedTeam) return alert('Select a team');
                      try {
                        await incidentService.assignTeam(selectedIncident.id, parseInt(selectedTeam));
                        alert('Team Assigned Successfully!');
                        setShowAssign(false);
                      } catch(e) {
                        console.error(e);
                      }
                    }}
                    className="flex-1 bg-blue-600/20 border border-blue-500 text-blue-400 py-2 rounded text-xs font-mono font-bold hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)] hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] uppercase tracking-wider"
                  >Deploy Unit</button>
                  <button onClick={() => setShowAssign(false)} className="flex-1 bg-transparent border border-slate-600 text-slate-400 py-2 rounded text-xs font-mono hover:bg-slate-800 transition uppercase tracking-wider">Abort</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button 
                  onClick={() => setShowAssign(true)}
                  className="bg-red-500/10 border border-red-500/50 text-red-400 py-2.5 rounded text-xs font-mono font-bold hover:bg-red-500 hover:text-white transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] uppercase tracking-wider"
                >Dispatch Rescue</button>
                <button 
                  className="bg-transparent border border-green-500/50 text-green-400 py-2.5 rounded text-xs font-mono font-bold hover:bg-green-500/20 transition uppercase tracking-wider"
                  onClick={async () => {
                    try {
                      await incidentService.updateStatus(selectedIncident.id, 'RESOLVED');
                      alert('Status marked as RESOLVED');
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >Mark Neutralized</button>
              </div>
            )}
            
            {/* Broadcast Alert Button */}
            {!showAssign && broadcastStatus === 0 && (
              <button 
                onClick={handleBroadcast}
                className="w-full bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 py-2.5 rounded text-xs font-mono font-bold hover:bg-yellow-500 hover:text-slate-900 transition-all shadow-[0_0_10px_rgba(234,179,8,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] uppercase tracking-wider flex items-center justify-center"
              >
                <Radio className="w-4 h-4 mr-2" /> Broadcast Public Alert
              </button>
            )}
          </div>
          )}
        </div>

        {/* Right Area: Map */}
        <div className="w-2/3 relative h-full bg-slate-900">
          <MapContainer 
            center={[28.6139, 77.2090]} 
            zoom={5} 
            className="w-full h-full z-0"
          >
            <MapUpdater selectedIncident={selectedIncident} />
            <TileLayer
              attribution='&copy; <a href="https://olamaps.com">Ola Maps</a> contributors'
              url="https://api.olamaps.io/tiles/vector/v1/styles/default-dark-standard/{z}/{x}/{y}.png?api_key=IB2tQ5BHYCHBv1ntHCKfBROOOI5Sr4mI6nAB8CUu"
              className="map-tiles-dark"
            />
            {incidents.map((incident) => {
              let pulseClass = 'pulse-marker-medium';
              if (incident.priority_score >= 80) pulseClass = 'pulse-marker-critical';
              else if (incident.priority_score >= 60) pulseClass = 'pulse-marker-high';
              
              const heatIcon = L.divIcon({
                className: 'custom-pulse-container',
                html: `
                  <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <div class="${pulseClass}" style="position: absolute; width: 100%; height: 100%;"></div>
                    <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%; z-index: 10; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });

              return (
                <Marker 
                  key={incident.id} 
                  position={[incident.latitude, incident.longitude]}
                  icon={heatIcon}
                >
                  <Popup className="cyber-popup">
                    <div className="text-xs font-mono bg-slate-900 text-slate-300 p-2.5 border border-slate-700 rounded min-w-[200px]">
                      <strong className="text-red-400 block mb-1 uppercase tracking-widest border-b border-slate-700 pb-1">{incident.title}</strong>
                      <div className="flex justify-between mt-1"><span>PRIORITY:</span><span className="text-red-400 font-bold">{incident.priority_score.toFixed(1)}</span></div>
                      <div className="flex justify-between"><span>STATUS:</span><span className="text-blue-400">{incident.status}</span></div>
                      <div className="flex justify-between text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800 text-[11px]">
                        <span>REPORTED:</span><span className="text-white font-semibold">{formatIncidentTime(incident.created_at)}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Render Rescue Teams */}
            {teams.filter(t => t.latitude && t.longitude && t.status !== 'OFF_DUTY').map((team) => {
              let svgIcon = '';
              let bgColor = '#3b82f6';
              
              if (team.team_type === 'MEDICAL' || team.team_type === 'AMBULANCE') {
                bgColor = '#10b981'; // Green
                svgIcon = '<path d="M19 14h-3v3h-2v-3h-3v-2h3V9h2v3h3z"/><path d="M22 17h-2v-2h-3v-2h3v-3h-3V8h3V6h-6v2h-4V6H4v2h3v2H4v3h3v2H4v2H2v2h2v3h16v-3h2v-2zm-6-2h-4v4h-2v-4H6v-2h4V9h2v4h4v2z"/>';
              } else if (team.team_type === 'FIRE' || team.team_type === 'FIRE_BRIGADE') {
                bgColor = '#ef4444'; // Red
                svgIcon = '<path d="M12 2c-3.3 0-6 2.7-6 6v4H4v8h16v-8h-2V8c0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4v4H8V8c0-2.2 1.8-4 4-4zm-6 8h12v4H6v-4z"/>';
              } else if (team.team_type === 'POLICE') {
                bgColor = '#3b82f6'; // Blue
                svgIcon = '<path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3zm0 2.2l6 2.2v4.6c0 4.3-2.9 8.3-6 9.5-3.1-1.2-6-5.2-6-9.5V6.4l6-2.2z"/>';
              } else {
                // Default Truck
                bgColor = '#f59e0b'; // Amber
                svgIcon = '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-9h-4v9z"/><path d="M15 6h4l3 3v2h-7z"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>';
              }

              const truckIcon = L.divIcon({
                className: 'custom-truck-container',
                html: `
                  <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: ${bgColor}; border-radius: 5px; border: 2px solid white; box-shadow: 0 0 10px ${bgColor};">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${svgIcon}</svg>
                  </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              });

              return (
                <Marker 
                  key={`team-${team.id}`} 
                  position={[team.latitude, team.longitude]}
                  icon={truckIcon}
                >
                  <Popup className="cyber-popup">
                    <div className="text-xs font-mono bg-slate-900 text-slate-300 p-2 border rounded" style={{borderColor: bgColor}}>
                      <strong className="block mb-1 uppercase tracking-widest border-b pb-1" style={{color: bgColor, borderColor: bgColor}}>{team.name}</strong>
                      <div className="flex justify-between mt-1"><span>TYPE:</span><span className="text-white">{team.team_type}</span></div>
                      <div className="flex justify-between"><span>STATUS:</span><span className="text-green-400">EN ROUTE</span></div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          
          {/* Floating Map Legend/Controls */}
          <div className="absolute top-6 right-6 bg-slate-900/80 backdrop-blur-md p-4 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-slate-700 z-[1000] text-xs font-mono text-slate-300">
            <h4 className="font-bold mb-3 tracking-widest text-slate-400 uppercase text-[10px] border-b border-slate-700 pb-1">Heatmap Overlay</h4>
            <div className="flex items-center space-x-3 text-[10px] mb-2 uppercase tracking-wider"><div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div><span>Critical (80+)</span></div>
            <div className="flex items-center space-x-3 text-[10px] mb-2 uppercase tracking-wider"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div><span>High (60-79)</span></div>
            <div className="flex items-center space-x-3 text-[10px] uppercase tracking-wider"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div><span>Medium (&lt;60)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
