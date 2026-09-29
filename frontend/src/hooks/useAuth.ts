import { useState, useEffect } from 'react';

// A simple hook to manage authentication state
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check local storage or async storage for user token here
    // Example:
    // const token = await AsyncStorage.getItem('token');
    // if (token) setIsAuthenticated(true);
  }, []);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  return { isAuthenticated, login, logout };
};
