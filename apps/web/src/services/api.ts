export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback to current hostname on port 3000
  // Respects current protocol (http/https) to avoid Mixed Content errors
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}:3000`;
};
