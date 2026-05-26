// src/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Rotas que podem retornar 401 por design (sem redirecionar)
const AUTH_ROUTES = ['/api/auth/login', '/api/auth/me'];

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    const is401 = error.response?.status === 401;
    const isAuthRoute = AUTH_ROUTES.some((route) => url.includes(route));

    if (is401 && !isAuthRoute) {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default API;
