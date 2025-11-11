import api from './client';

export const healthAPI = {
  check: () => api.get('/health', { 'axios-retry': { retries: 0 } }),
};

export default healthAPI;
