export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback to current hostname on port 3000
  return `http://${window.location.hostname}:3000`;
};
