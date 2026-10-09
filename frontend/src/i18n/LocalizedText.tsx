import React from 'react';
import { Platform, StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { useLanguage } from './LanguageContext';

// Inter contains Latin glyphs only. Use the platform font for Sinhala and Tamil.
export function LocalizedText({ style, children, ...props }: TextProps) {
  const { language, t } = useLanguage();
  const resolvedStyle = StyleSheet.flatten(style);

  const translateNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      if (!node.trim()) return node;
      return t(node);
    }
    if (Array.isArray(node)) {
      return React.Children.map(node, translateNode);
    }
    return node;
  };

  const localizedChildren = language === 'en' ? children : React.Children.map(children, translateNode);

  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: Platform.select({
            web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            ios: 'Inter',
            android: 'Inter',
            default: 'Inter',
          }),
        },
        style,
        language !== 'en' && {
          fontFamily: Platform.select({
            web: "'Noto Sans Sinhala', 'Noto Sans Tamil', 'Inter', -apple-system, sans-serif",
            ios: 'System',
            android: 'sans-serif',
            default: 'sans-serif',
          }),
          letterSpacing: 0,
        },
      ]}
    >
      {localizedChildren}
    </RNText>
  );
}
