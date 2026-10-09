import React from 'react';
import { Platform, StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { useLanguage } from './LanguageContext';

// Inter contains Latin glyphs only. Use the platform font for Sinhala and Tamil.
export function LocalizedText({ style, children, ...props }: TextProps) {
  const { language } = useLanguage();
  
  const resolvedStyle = StyleSheet.flatten(style) || {};
  let fontFamily = 'Inter_400Regular';
  
  if (language === 'en') {
    const fw = String(resolvedStyle.fontWeight || '400');
    if (fw === 'bold' || fw === '700') fontFamily = 'Inter_700Bold';
    else if (fw === '600') fontFamily = 'Inter_600SemiBold';
    else if (fw === '800' || fw === '900') fontFamily = 'Inter_800ExtraBold';
    else if (fw === '500') fontFamily = 'Inter_500Medium';
  } else {
    fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
  }

  // We should remove fontWeight from the style to prevent RN from trying to apply it to a custom font, which sometimes causes issues on Android
  const { fontWeight, ...safeStyle } = resolvedStyle;

  return (
    <RNText
      {...props}
      style={[
        safeStyle,
        { fontFamily },
        language !== 'en' && { letterSpacing: 0 }
      ]}
    >
      {children}
    </RNText>
  );
}
