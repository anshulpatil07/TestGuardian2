import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock } from 'react-icons/fi';
import apiClient from '../api/axios';

const SignIn = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/signin', formData);
      const data = response.data;

      localStorage.setItem('guardian_user', JSON.stringify(data.user));
      if (data.user.role === 'instructor') navigate('/instructor-dashboard');
      else navigate('/student-dashboard');
    } catch (err) {
      localStorage.removeItem('guardian_user');
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Network error. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-800 via-purple-700 to-pink-600 flex items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">Sign In</h1>
          <p className="text-white/80">Access your account securely</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="relative">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder=" "
              className="peer w-full bg-white/20 text-white placeholder-transparent rounded-xl px-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
            />
            <FiMail className="absolute left-4 top-4 text-white/70" />
            <label className="absolute left-12 top-4 text-white/70 text-sm peer-placeholder-shown:top-4 peer-placeholder-shown:text-white/70 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-blue-400 transition-all">
              Email
            </label>
          </div>

          {/* Password */}
          <div className="relative">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder=" "
              className="peer w-full bg-white/20 text-white placeholder-transparent rounded-xl px-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
            />
            <FiLock className="absolute left-4 top-4 text-white/70" />
            <label className="absolute left-12 top-4 text-white/70 text-sm peer-placeholder-shown:top-4 peer-placeholder-shown:text-white/70 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-blue-400 transition-all">
              Password
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
