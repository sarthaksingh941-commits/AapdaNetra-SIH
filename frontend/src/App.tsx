import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CitizenReportPage from './pages/CitizenReportPage';
import MyReportsPage from './pages/MyReportsPage';
import DashboardPage from './pages/DashboardPage';
import IncidentDetailsPage from './pages/IncidentDetailsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/report" element={<CitizenReportPage />} />
          <Route path="/my-reports" element={<MyReportsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
