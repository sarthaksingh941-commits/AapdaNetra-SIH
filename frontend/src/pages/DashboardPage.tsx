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
    return Object.keys(counts).filter(k => counts[k] > 0).map(key => ({ name: key, value: counts[k] }));
  }, [incidents]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          <span className="text-xl font-bold">Command Dashboard</span>
        </div>
        <div className="flex space-x-4">
          <div className="bg-slate-800 px-3 py-1 rounded-full text-sm font-medium border border-slate-700">
            Admin View
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-1/3 bg-white flex flex-col shadow-lg z-10">
          
          {/* Tabs */}
          <div className="flex border-b">
            <button 
              onClick={() => setActiveTab('list')} 
              className={`flex-1 py-3 font-semibold text-sm flex items-center justify-center ${activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4 mr-2"/> Incidents
            </button>
            <button 
              onClick={() => setActiveTab('analytics')} 
              className={`flex-1 py-3 font-semibold text-sm flex items-center justify-center ${activeTab === 'analytics' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <BarChart3 className="w-4 h-4 mr-2"/> Analytics
            </button>
          </div>

          {activeTab === 'list' ? (
            <>
              <div className="p-4 border-b">
                <h2 className="font-bold text-lg text-slate-800 flex items-center justify-between">
                  <span>Active Incidents</span>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">{incidents.length} Critical</span>
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? <div className="p-4 text-center text-gray-500">Loading incidents...</div> : incidents.length === 0 ? <div className="p-4 text-center text-gray-500">No active incidents.</div> : null}
                {incidents.map((incident) => (
                  <div 
                    key={incident.id} 
                    onClick={() => setSelectedIncident(incident)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${selectedIncident?.id === incident.id ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800">{incident.title}</h3>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">{incident.status}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-red-600 font-bold">Priority: {incident.priority_score.toFixed(1)}/100</span>
                      <span className="text-gray-500 flex items-center"><Clock className="h-3 w-3 mr-1"/> {new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="flex text-xs text-gray-500 space-x-3">
                      <span className="flex items-center"><Users className="h-3 w-3 mr-1"/> {incident.reports?.length || 0} reports</span>
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-1"/> {incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <h2 className="font-bold text-lg text-slate-800 mb-4">Disaster Analytics</h2>
              
              {incidents.length === 0 ? (
                <div className="text-gray-500 text-center mt-10">Not enough data to generate charts.</div>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
                    <h3 className="font-semibold text-gray-600 mb-4 text-sm text-center">Incidents by Type</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeData} innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                            {typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {typeData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center text-xs text-gray-600">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          {entry.name} ({entry.value})
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <h3 className="font-semibold text-gray-600 mb-4 text-sm text-center">Severity Distribution</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={severityData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{fontSize: 12}} />
                          <YAxis allowDecimals={false} tick={{fontSize: 12}} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
          <div className="p-4 bg-slate-50 border-t">
            <h3 className="font-bold text-sm text-slate-700 mb-2">Quick Actions: #{selectedIncident.id}</h3>
            
            {showAssign ? (
              <div className="space-y-2">
                <select 
                  className="w-full border p-2 rounded text-sm"
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  value={selectedTeam}
                >
                  <option value="">-- Select Team --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_type})</option>)}
                </select>
                <div className="flex space-x-2">
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
                    className="flex-1 bg-green-600 text-white py-1 rounded text-sm font-medium hover:bg-green-700 transition"
                  >Confirm</button>
                  <button onClick={() => setShowAssign(false)} className="flex-1 bg-gray-300 text-gray-800 py-1 rounded text-sm font-medium hover:bg-gray-400 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setShowAssign(true)}
                  className="bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 transition"
                >Assign Rescue Team</button>
                <button 
                  className="bg-white border border-slate-300 text-slate-700 py-2 rounded text-sm font-medium hover:bg-slate-100 transition"
                  onClick={async () => {
                    try {
                      await incidentService.updateStatus(selectedIncident.id, 'RESOLVED');
                      alert('Status marked as RESOLVED');
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >Mark Resolved</button>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right Area: Map */}
        <div className="w-2/3 relative h-full">
          <MapContainer 
            center={[28.6139, 77.2090]} 
            zoom={5} 
            className="w-full h-full"
          >
            <MapUpdater selectedIncident={selectedIncident} />
            <TileLayer
              attribution='&copy; <a href="https://olamaps.com">Ola Maps</a> contributors'
              url="https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/{z}/{x}/{y}.png?api_key=IB2tQ5BHYCHBv1ntHCKfBROOOI5Sr4mI6nAB8CUu"
            />
            {incidents.map((incident) => (
              <Marker 
                key={incident.id} 
                position={[incident.latitude, incident.longitude]}
              >
                <Popup>
                  <div className="text-sm">
                    <strong className="text-red-600 block">{incident.title}</strong>
                    Priority: {incident.priority_score.toFixed(1)} <br/>
                    Status: {incident.status}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          {/* Floating Map Legend/Controls */}
          <div className="absolute top-4 right-4 bg-white p-3 rounded shadow-lg z-[1000] text-sm">
            <h4 className="font-bold mb-2">Severity Overlay</h4>
            <div className="flex items-center space-x-2 text-xs mb-1"><div className="w-3 h-3 bg-red-600 rounded-full"></div><span>Critical (80+)</span></div>
            <div className="flex items-center space-x-2 text-xs mb-1"><div className="w-3 h-3 bg-orange-500 rounded-full"></div><span>High (60-79)</span></div>
            <div className="flex items-center space-x-2 text-xs"><div className="w-3 h-3 bg-yellow-400 rounded-full"></div><span>Medium (&lt;60)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
