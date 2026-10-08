import React, { createContext, useState, useContext, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  isDarkMode: false,
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        } else {
          const systemTheme = Appearance.getColorScheme();
          if (systemTheme) setTheme(systemTheme as ThemeType);
        }
      } catch (e) {
      } finally {
        setIsReady(true);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      Colors.background = '#121212';
      Colors.white = '#1e1e1e';
      Colors.cardBackground = '#1e1e1e';
      Colors.textDark = '#ffffff';
      Colors.text = '#e0e0e0';
      Colors.textMedium = '#aaaaaa';
      Colors.divider = '#333333';
      Colors.border = '#333333';
    } else {
      Colors.background = '#f4f9fb';
      Colors.white = '#ffffff';
      Colors.cardBackground = '#ffffff';
      Colors.textDark = '#0d2e35';
      Colors.text = '#0d2e35';
      Colors.textMedium = '#4a6572';
      Colors.divider = '#e8f4f7';
      Colors.border = '#d0e8ed';
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('appTheme', newTheme);
    } catch (e) {}
  };

  if (!isReady) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
