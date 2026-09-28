// Example API service configuration
// You can configure Axios or fetch here later

export const api = {
  get: async (url: string) => {
    // const response = await fetch(url);
    // return response.json();
    console.log(`GET request to ${url}`);
  },
  post: async (url: string, data: any) => {
    // const response = await fetch(url, { method: 'POST', body: JSON.stringify(data) });
    // return response.json();
    console.log(`POST request to ${url} with data:`, data);
  }
};
