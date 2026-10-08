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
        style,
        language !== 'en' && {
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          letterSpacing: 0,
        },
      ]}
    >
      {localizedChildren}
    </RNText>
  );
}
