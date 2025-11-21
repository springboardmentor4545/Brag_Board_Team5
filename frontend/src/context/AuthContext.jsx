import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';
import { emitToast } from '../utils/toast.js';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
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
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await userAPI.getMe();
          setUser(normalizeUser(response.data));
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setLoading(false);
    };

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

  const login = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const passwordValue = String(password || '');
    try {
      const response = await authAPI.login({ email: normalizedEmail, password: passwordValue }, { skipErrorToast: true });
      const { access_token, refresh_token } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const userResponse = await userAPI.getMe();
      const normalized = normalizeUser(userResponse.data);
      setUser(normalized);
      emitToast('success', normalized?.name ? `Welcome back, ${normalized.name.split(' ')[0]}!` : 'Welcome back!');
      return normalized;
    } catch (error) {
      const message = error?.response?.data?.detail
        || error?.response?.data?.message
        || error?.message
        || 'Invalid credentials. Please try again.';
      emitToast('error', message);
      const normalizedError = new Error(message);
      if (error?.response) {
        normalizedError.response = {
          ...error.response,
          data: {
            ...error.response.data,
            detail: message,
            message,
          },
        };
        normalizedError.status = error.response.status;
      }
      normalizedError.originalError = error;
      throw normalizedError;
    }
  };

  const register = async (userData) => {
    const payload = {
      ...userData,
      name: String(userData?.name || '').trim(),
      email: String(userData?.email || '').trim().toLowerCase(),
      password: String(userData?.password || ''),
      department: userData?.department ? String(userData.department).trim() : userData?.department,
      role: userData?.role ? String(userData.role).trim() : userData?.role,
    };
    try {
      const response = await authAPI.register(payload, { skipErrorToast: true });
      if (response.data?.requires_verification) {
        const message = response.data?.message
          || 'Registration successful. Please verify your email to complete setup.';
        emitToast('success', message);
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
        emitToast('success', normalized?.name ? `Welcome aboard, ${normalized.name.split(' ')[0]}!` : 'Welcome to Brag Board!');
        return normalized;
      }
      emitToast('success', 'Registration complete. You can now sign in.');
      return response.data;
    } catch (error) {
      const message = error?.response?.data?.detail || 'Registration failed. Please try again.';
      emitToast('error', message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    emitToast('info', 'Signed out successfully.');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
