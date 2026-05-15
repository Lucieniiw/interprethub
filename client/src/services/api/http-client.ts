import axios from "axios";

// IMPORTANT: no domain in production or dev
const baseURL = "/api";

export const api = axios.create({
  baseURL,
  timeout: 30_000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
