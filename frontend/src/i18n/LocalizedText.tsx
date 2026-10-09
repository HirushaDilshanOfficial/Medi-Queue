import React from 'react';
import { Platform, Text as RNText, type TextProps } from 'react-native';
import { useLanguage } from './LanguageContext';

// Inter contains Latin glyphs only. Use the platform font for Sinhala and Tamil.
export function LocalizedText({ style, children, ...props }: TextProps) {
  const { language } = useLanguage();

  return (
    <RNText
      {...props}
      style={[
        style,
        language !== 'en' && {
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          letterSpacing: 0,
        },
      ]}
    >
      {children}
    </RNText>
  );
}
