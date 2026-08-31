import axios from 'axios';

// Use environment variable if available, otherwise default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
});

// Add a request interceptor to automatically attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authService = {
  register: async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};

export const reportService = {
  createReport: async (reportData: any) => {
    const response = await api.post('/reports/', reportData);
    return response.data;
  },
  getMyReports: async () => {
    const response = await api.get('/reports/my');
    return response.data;
  }
};

export const teamService = {
  getAllTeams: async () => {
    const response = await api.get('/teams/');
    return response.data;
  }
};

export const incidentService = {
  getAllIncidents: async () => {
    const response = await api.get('/incidents/');
    return response.data;
  },
  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/incidents/${id}/status`, { status });
    return response.data;
  },
  assignTeam: async (incidentId: number, teamId: number, notes: string = '') => {
    const response = await api.post(`/incidents/${incidentId}/assign`, {
      incident_id: incidentId,
      team_id: teamId,
      notes
    });
    return response.data;
  }
};

export default api;
