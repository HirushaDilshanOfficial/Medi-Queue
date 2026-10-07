import React from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import { useLanguage } from './LanguageContext';

// Inter contains Latin glyphs only. Use the platform font for Sinhala and Tamil.
export function LocalizedText({ style, ...props }: TextProps) {
  const { language } = useLanguage();
  const resolvedStyle = StyleSheet.flatten(style);
  return <Text {...props} style={[style, language !== 'en' && {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    lineHeight: Math.max(resolvedStyle?.lineHeight ?? 0, (resolvedStyle?.fontSize ?? 14) * 1.6),
    letterSpacing: 0,
  }]} />;
}
