import axios from 'axios';
const configuredBaseURL = import.meta.env.VITE_API_BASE_URL || 'https://codeforge-judge-online-1.onrender.com';
const trimmedBaseURL = configuredBaseURL.replace(/\/+$/, '');
const baseURL = /\/api$/i.test(trimmedBaseURL) ? trimmedBaseURL : `${trimmedBaseURL}/api`;
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
