import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Define user interface
const AuthContext = createContext(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is logged in on page load
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Check authentication with the correct endpoint
      const checkAuth = async () => {
        try {
          const response = await api.get('/auth/me');
          setCurrentUser(response.data.data);
          console.log('Auth check successful:', response.data);
        } catch (err) {
          console.error('Failed to verify authentication:', err);
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        } finally {
          setLoading(false);
        }
      };
      
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      // Use the correct login endpoint
      console.log('Attempting login with endpoint: /auth/login');
      const response = await api.post('/auth/login', { email, password });
      console.log('Login successful:', response.data);
      
      // Handle successful login
      const { data } = response.data;
      localStorage.setItem('token', data.accessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
      setCurrentUser(data.user);
      setError(null);
      return true;
    } catch (err) {
      console.error('Login failed:', err.response?.data);
      setError(err.response?.data?.error?.message || 'Failed to login. Please check your credentials.');
      throw new Error('Login failed');
    }
  };

  const register = async (email, password, firstName, lastName, phone = null) => {
    try {
      // Use the correct registration endpoint
      console.log('Attempting registration with endpoint: /auth/register');
      console.log('Registration payload:', { email, password, firstName, lastName, phone });
      
      const response = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        phone
      });
      
      console.log('Registration successful:', response.data);
      
      // Note: The registration endpoint doesn't return a token
      // User needs to login after registration
      setError(null);
      return true;
    } catch (err) {
      console.error('Registration failed:', err.response?.data);
      setError(err.response?.data?.error?.message || 'Failed to register. Please try again.');
      throw new Error('Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
