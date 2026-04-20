// Configuration file for API endpoints
window.API_BASE = "http://26.185.77.179:3000"; // БЕЗ лишних точек с запятой внутри кавычек// Retry fetch function
window.retryFetch = async (url, options = {}, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || i === retries - 1) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};
