import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const normalizeUser = (raw) => {
    if (!raw) return raw;
    // Backward compatibility: if role missing but is_admin flag present
    if (!raw.role) {
      raw.role = raw.is_admin ? 'admin' : 'employee';
    }
    return raw;
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const response = await userAPI.getMe();
        setUser(normalizeUser(response.data));
      } catch (error) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    const userResponse = await userAPI.getMe();
    const normalized = normalizeUser(userResponse.data);
    setUser(normalized);
    return normalized;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    if (response.data?.requires_verification) {
      // Do not log in yet; wait for email verification
      return response.data;
    }
    // Fallback to legacy behavior if backend still returns tokens
    const { access_token, refresh_token } = response.data || {};
    if (access_token && refresh_token) {
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
  const userResponse = await userAPI.getMe();
  const normalized = normalizeUser(userResponse.data);
  setUser(normalized);
  return normalized;
    }
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
