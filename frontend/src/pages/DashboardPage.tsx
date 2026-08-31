import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Clock, MapPin, Users, ShieldAlert, BarChart3, List } from 'lucide-react';
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

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const user = authService.getCurrentUser();
  const navigate = useNavigate();

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
        const data = await teamService.getAllTeams();
        setTeams(data);
      } catch (err) {
        console.error("Failed to fetch teams", err);
      }
    };

    fetchIncidents();
    fetchTeams();
    // Poll every 2 seconds for instant MVP realtime feel
    const interval = setInterval(fetchIncidents, 2000);
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
        <div className="flex items-center space-x-6">
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
                      <span className="text-slate-400 flex items-center"><Clock className="h-3 w-3 mr-1.5 text-blue-400"/> {new Date(incident.created_at).toLocaleTimeString()}</span>
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
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
              <h2 className="font-mono text-sm text-slate-400 mb-6 tracking-widest uppercase">Global Analytics</h2>
              
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
            <h3 className="font-mono text-xs text-blue-400 mb-4 flex items-center uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
              Targeting: #{selectedIncident.id.toString().padStart(4, '0')}
            </h3>
            
            {showAssign ? (
              <div className="space-y-3">
                <select 
                  className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2.5 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  value={selectedTeam}
                >
                  <option value="">-- SELECT RESPONDER TEAM --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>)}
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
              <div className="grid grid-cols-2 gap-3">
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
                    <div className="text-xs font-mono bg-slate-900 text-slate-300 p-2 border border-slate-700 rounded">
                      <strong className="text-red-400 block mb-1 uppercase tracking-widest border-b border-slate-700 pb-1">{incident.title}</strong>
                      <div className="flex justify-between mt-1"><span>PRIORITY:</span><span className="text-red-400">{incident.priority_score.toFixed(1)}</span></div>
                      <div className="flex justify-between"><span>STATUS:</span><span className="text-blue-400">{incident.status}</span></div>
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
