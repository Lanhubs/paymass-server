import axios, { AxiosRequestConfig } from 'axios';

const blockradar = axios.create({
  baseURL: process.env.BLOCKRADAR_BASE_URL,
  headers: {
    'x-api-key': process.env.BLOCKRADAR_API_KEY ?? "",
    'Content-Type': 'application/json'
  },
  timeout: 30000
});



const paycrest = axios.create({
  baseURL: process.env.PAYCREST_BASE_URL,
  headers: {
    'API-Key': process.env.PAYCREST_API_KEY ?? "",
    'Content-Type': 'application/json'
  },
  timeout: parseInt(process.env.PAYCREST_TIMEOUT ?? "30000") // Default to 30 seconds
});
paycrest.interceptors.request.use(
  (config:any ) => {
    // Check for a custom `disableAuth` flag in the request config
    if (config.disableAuth) {
      // If the flag is true, delete the API-Key header
      delete config.headers['API-Key'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Request interceptor for logging and error handling
paycrest.interceptors.request.use(
  (config) => {
    // Log request details in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Paycrest API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
        headers: config.headers,
        data: config.data
      });
    }
    return config;
  },
  (error) => {
    console.error('[Paycrest API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
paycrest.interceptors.response.use(
  (response) => {
    // Log response details in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Paycrest API Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.baseURL}${response.config.url}`);
    }
    return response;
  },
  (error) => {
    console.error('[Paycrest API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
const paystack = axios.create({
  baseURL: process.env.PAYSTACK_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
})
export { blockradar, paycrest, paystack};