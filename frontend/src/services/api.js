import axios from 'axios';

// Create API instance with configurable base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://accounting-app-klwxs.ondigitalocean.app',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout
} );

// Add a request interceptor to include the auth token in all requests
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method.toUpperCase()} request to: ${config.baseURL}${config.url}`);
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}:`, response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`Error ${error.response.status} from ${error.config.url}:`, error.response.data);
      
      if (error.response.status === 401) {
        // Unauthorized - clear token and redirect to login
        console.log('Unauthorized access, redirecting to login');
        localStorage.removeItem('token');
        window.location.href = '/#/login';
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
