// API configuration
// Set VITE_API_URL in your .env file to override the default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://echoroom-p25k.onrender.com';

export const config = {
  API_BASE_URL,
  HUB_URL: `${API_BASE_URL}/hubs/chat`,
  ENDPOINTS: {
    LOGIN: `${API_BASE_URL}/api/Auth/login`,
    ROOM_HISTORY: `${API_BASE_URL}/api/Chat/room`,
    PRIVATE_HISTORY: (username) => `${API_BASE_URL}/api/Chat/private/${username}`,
    ACTIVE_USERS: `${API_BASE_URL}/api/Chat/active-users`,
  },
};
