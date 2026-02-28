import axios from "axios";

import { API_BASE_URL } from "@/config/settings";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export default client;
