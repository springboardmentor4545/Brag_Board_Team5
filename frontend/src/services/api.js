import axios from 'axios';
import { emitToast } from '../utils/toast.js';

const rawBaseUrl = typeof import.meta.env?.VITE_API_BASE_URL === 'string'
  ? import.meta.env.VITE_API_BASE_URL.trim()
  : '';

const API_URL = rawBaseUrl
  ? rawBaseUrl.replace(/\/$/, '')
  : '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel?.(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token: newRefreshToken } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefreshToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          emitToast('info', 'Your session expired. Please sign in again.');
          window.location.href = '/login';
        }
      }
    }

    const { response } = error;
    const suppressToast = originalRequest?.skipErrorToast;

    if (!response) {
      if (!suppressToast) {
        emitToast('error', 'Network error. Please check your connection and try again.');
      }
      return Promise.reject(error);
    }

    if (!suppressToast && response.status !== 401) {
      const message = response.data?.detail
        || response.data?.message
        || response.data?.error
        || (response.status >= 500
          ? 'Something went wrong on our side. Please try again shortly.'
          : `Request failed with status ${response.status}`);

      emitToast('error', message);
    }

    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data, config = {}) => api.post('/auth/register', data, config),
  login: (data, config = {}) => api.post('/auth/login', data, config),
  forgotPassword: (data, config = {}) => api.post('/auth/forgot-password', data, config),
  resetPassword: (data, config = {}) => api.post('/auth/reset-password', data, config),
};

export const userAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getUsers: (department) => api.get('/users', { params: { department } }),
  search: (query) => api.get('/users/search', { params: { query } }),
};

export const shoutoutAPI = {
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/shoutouts', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/shoutouts', data);
  },
  getAll: (params) => api.get('/shoutouts', { params }),
  getOne: (id, config = {}) => api.get(`/shoutouts/${id}`, config),
  update: (id, data, config = {}) => api.put(`/shoutouts/${id}`, data, config),
  delete: (id, config = {}) => api.delete(`/shoutouts/${id}`, config),
};

export const commentAPI = {
  create: (shoutoutId, data) => api.post(`/shoutouts/${shoutoutId}/comments`, data),
  getAll: (shoutoutId) => api.get(`/shoutouts/${shoutoutId}/comments`),
  update: (commentId, data, config = {}) => api.put(`/shoutouts/comments/${commentId}`, data, config),
  delete: (commentId, config = {}) => api.delete(`/shoutouts/comments/${commentId}`, config),
  report: (commentId, reason) => api.post(`/shoutouts/comments/${commentId}/report`, { reason }),
};

export const reactionAPI = {
  add: (shoutoutId, type) => api.post(`/shoutouts/${shoutoutId}/reactions`, { type }),
  remove: (shoutoutId, type) => api.delete(`/shoutouts/${shoutoutId}/reactions/${type}`),
  listUsers: (shoutoutId, type) => api.get(`/shoutouts/${shoutoutId}/reactions`, { params: { reaction_type: type } }),
  listAllUsers: (shoutoutId) => api.get(`/shoutouts/${shoutoutId}/reactions`),
};

export const adminAPI = {
  getAnalytics: () => api.get('/admin/analytics'),
  getReports: (status) => api.get('/admin/reports', { params: status ? { status } : undefined }),
  resolveReport: (reportId, action, config = {}) => api.post(`/admin/reports/${reportId}/resolve`, { action }, config),
  deleteShoutout: (id, config = {}) => api.delete(`/admin/shoutouts/${id}`, config),
  getLeaderboard: () => api.get('/admin/leaderboard'),
  reportShoutout: (shoutoutId, reason) => api.post(`/admin/shoutouts/${shoutoutId}/report`, { reason }),
  deleteComment: (commentId, config = {}) => api.delete(`/shoutouts/comments/${commentId}`, config),
  getDepartmentChangeRequests: (status) => api.get('/admin/department-change-requests', { params: { status } }),
  decideDepartmentChangeRequest: (requestId, action, config = {}) => api.post(`/admin/department-change-requests/${requestId}/decision`, { action }, config),
  getRoleChangeRequests: (status) => api.get('/admin/role-change-requests', { params: { status } }),
  decideRoleChangeRequest: (requestId, action, config = {}) => api.post(`/admin/role-change-requests/${requestId}/decision`, { action }, config),
  getCommentReports: (status) => api.get('/admin/comment-reports', { params: status ? { status } : undefined }),
  resolveCommentReport: (reportId, action, config = {}) => api.post(`/admin/comment-reports/${reportId}/resolve`, { action }, config),
  downloadAdminLogs: (params, config = {}) => api.get('/admin/exports/logs', {
    ...config,
    params,
    responseType: 'blob',
  }),
  downloadReports: (params, config = {}) => api.get('/admin/exports/reports', {
    ...config,
    params,
    responseType: 'blob',
  }),
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.post('/notifications/mark-read', ids ? { ids } : {}),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  clearAll: () => api.delete('/notifications'),
};
