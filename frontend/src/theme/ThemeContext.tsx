<<<<<<< HEAD
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@medi_queue_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'light',
  isDark: false,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (e) {
        // Fallback to default
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return systemColorScheme === 'dark';
  }, [themeMode, systemColorScheme]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {}
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      isDark,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, isDark, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
=======
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
>>>>>>> origin/dev
};

export const useTheme = () => useContext(ThemeContext);
