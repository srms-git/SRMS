import axios from "axios";

// Default to /api so Vite dev proxy forwards to the backend (see vite.config.js).
const rawBaseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const normalizedBaseUrl = /\/api$/i.test(rawBaseUrl) ? rawBaseUrl : `${rawBaseUrl}/api`;

const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;