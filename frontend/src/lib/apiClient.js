import axios from "axios";
import { getApiClientBaseUrl, getNetworkErrorMessage } from "@/lib/apiConfig";

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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const networkMessage = getNetworkErrorMessage(error);
    if (networkMessage) {
      error.userMessage = networkMessage;
    }
    return Promise.reject(error);
  },
);

export default apiClient;