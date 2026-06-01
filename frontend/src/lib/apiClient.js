import axios from "axios";
import { getApiClientBaseUrl } from "@/lib/apiConfig";

const normalizedBaseUrl = getApiClientBaseUrl();

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