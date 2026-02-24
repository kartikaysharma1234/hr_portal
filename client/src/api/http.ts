import axios, { AxiosHeaders } from 'axios';

let accessToken: string | null = null;
let tenantSubdomain: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const setTenantSubdomain = (subdomain: string | null): void => {
  tenantSubdomain = subdomain;
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api',
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? new AxiosHeaders();

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (tenantSubdomain) {
    config.headers.set('x-tenant-subdomain', tenantSubdomain);
  }

  return config;
});
