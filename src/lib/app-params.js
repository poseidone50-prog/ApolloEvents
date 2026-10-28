const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};

export const appParams = {
  appId: env.VITE_APP_ID || "your-app-id",
  token: env.VITE_TOKEN || "your-api-token",
  functionsVersion: env.VITE_FUNCTIONS_VERSION || "v1",
  appBaseUrl: env.VITE_APP_BASE_URL || "http://localhost:5173",
};
