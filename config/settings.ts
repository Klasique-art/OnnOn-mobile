const isProduction = !__DEV__;

export const API_BASE_URL = isProduction ? "http://10.0.2.2:3000/api" : "http://10.0.2.2:3000/api";
