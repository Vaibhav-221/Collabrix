import { apiClient } from "./client";

export function getCurrentUser() {
  return apiClient.get("/auth/me");
}

export function loginUser(credentials) {
  return apiClient.post("/auth/login", credentials);
}

export function registerUser(payload) {
  return apiClient.post("/auth/register", payload);
}

export function logoutUser() {
  return apiClient.post("/auth/logout");
}
