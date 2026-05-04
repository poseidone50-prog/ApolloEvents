export const appParams = {
  appId: import.meta.env.VITE_APP_ID || "your-app-id",
  token: import.meta.env.VITE_TOKEN || "your-api-token",
  functionsVersion: import.meta.env.VITE_FUNCTIONS_VERSION || "v1",
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || "http://localhost:5173",
};