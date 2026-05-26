import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:5000/api",
});

// This "Interceptor" acts like a gatekeeper for every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("userToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;