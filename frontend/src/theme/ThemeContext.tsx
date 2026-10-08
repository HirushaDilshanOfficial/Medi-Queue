import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeType = 'light' | 'dark';

export interface ThemeContextValue {
  theme: ThemeType;
  themeMode: ThemeMode;
  isDark: boolean;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@medi_queue_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  themeMode: 'light',
  isDark: false,
  isDarkMode: false,
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
        const saved = (await AsyncStorage.getItem(THEME_STORAGE_KEY)) || (await AsyncStorage.getItem('appTheme'));
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved as ThemeMode);
        } else {
          const sys = Appearance.getColorScheme();
          if (sys === 'dark' || sys === 'light') {
            setThemeModeState(sys);
          }
        }
      } catch (e) {
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

  useEffect(() => {
    if (isDark) {
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
  }, [isDark]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      await AsyncStorage.setItem('appTheme', mode === 'dark' ? 'dark' : 'light');
    } catch (e) {}
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const value = useMemo(
    () => ({
      theme: (isDark ? 'dark' : 'light') as ThemeType,
      themeMode,
      isDark,
      isDarkMode: isDark,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, isDark, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
