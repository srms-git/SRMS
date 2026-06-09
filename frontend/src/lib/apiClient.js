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
  async (error) => {
    const networkMessage = getNetworkErrorMessage(error);
    if (networkMessage) {
      error.userMessage = networkMessage;
    }

    const config = error.config;
    const method = String(config?.method ?? "get").toLowerCase();
    const status = error.response?.status;
    const isRetriableGet =
      config &&
      !config.__retry &&
      method === "get" &&
      (!status || status >= 500);

    if (isRetriableGet) {
      config.__retry = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);

export default apiClient;