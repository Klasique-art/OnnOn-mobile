const isProduction = !__DEV__;

const DEV_API_URL = "http://[ip address]:3000";
const PROD_API_URL = "http://[ip address]:3000";

export const API_BASE_URL = isProduction ? PROD_API_URL : DEV_API_URL;

