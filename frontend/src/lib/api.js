import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("access_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("access_token");
      const p = window.location.pathname;
      const publicPaths = ["/login", "/forgot-password"];
      if (!publicPaths.some((x) => p.startsWith(x))) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

/** Turn any FastAPI error payload into a printable string. */
export function apiError(e, fallback = "Something went wrong") {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(x => x?.msg || JSON.stringify(x)).join(" • ");
  return d?.msg || JSON.stringify(d);
}
