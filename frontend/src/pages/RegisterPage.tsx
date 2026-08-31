import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'CITIZEN' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.register(formData);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="px-8 py-6 text-left bg-white shadow-lg rounded-lg w-full max-w-md">
        <h3 className="text-2xl font-bold text-center text-blue-900">Create an Account</h3>
        {error && <div className="mt-4 p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}
        <form className="mt-4" onSubmit={handleSubmit}>
          <div className="mt-4">
            <label className="block text-gray-700">Full Name</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
          <div className="mt-4">
            <label className="block text-gray-700">Email</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
          <div className="mt-4">
            <label className="block text-gray-700">Password</label>
            <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Password" className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
          <div className="mt-4">
            <label className="block text-gray-700">Role</label>
            <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white">
              <option value="CITIZEN">Citizen</option>
              <option value="RESPONDER">Rescue Responder</option>
            </select>
          </div>
          <div className="flex items-baseline justify-between mt-6">
            <button disabled={loading} className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-900 w-full font-bold disabled:opacity-50">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">Already have an account? Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
