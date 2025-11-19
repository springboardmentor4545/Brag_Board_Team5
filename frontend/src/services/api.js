import axios from 'axios';

const API_URL = '/api';

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
    const originalRequest = error.config;
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
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
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
  getOne: (id) => api.get(`/shoutouts/${id}`),
  update: (id, data) => api.put(`/shoutouts/${id}`, data),
  delete: (id) => api.delete(`/shoutouts/${id}`),
};

export const commentAPI = {
  create: (shoutoutId, data) => api.post(`/shoutouts/${shoutoutId}/comments`, data),
  getAll: (shoutoutId) => api.get(`/shoutouts/${shoutoutId}/comments`),
  update: (commentId, data) => api.put(`/shoutouts/comments/${commentId}`, data),
  delete: (commentId) => api.delete(`/shoutouts/comments/${commentId}`),
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
  resolveReport: (reportId, action) => api.post(`/admin/reports/${reportId}/resolve`, { action }),
  deleteShoutout: (id) => api.delete(`/admin/shoutouts/${id}`),
  getLeaderboard: () => api.get('/admin/leaderboard'),
  reportShoutout: (shoutoutId, reason) => api.post(`/admin/shoutouts/${shoutoutId}/report`, { reason }),
  deleteComment: (commentId) => api.delete(`/shoutouts/comments/${commentId}`),
  getDepartmentChangeRequests: (status) => api.get('/admin/department-change-requests', { params: { status } }),
  decideDepartmentChangeRequest: (requestId, action) => api.post(`/admin/department-change-requests/${requestId}/decision`, { action }),
  getCommentReports: (status) => api.get('/admin/comment-reports', { params: status ? { status } : undefined }),
  resolveCommentReport: (reportId, action) => api.post(`/admin/comment-reports/${reportId}/resolve`, { action }),
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.post('/notifications/mark-read', ids ? { ids } : {}),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  clearAll: () => api.delete('/notifications'),
};
