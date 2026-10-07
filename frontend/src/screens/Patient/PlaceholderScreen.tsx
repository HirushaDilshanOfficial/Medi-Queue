import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type PlaceholderProps = {
  title: string;
  description: string;
};

// Temporary shell for the screens delivered in Parts 2-4. The tab bar and
// navigation are live in Part 1 so the routes can be exercised end to end.
export function PlaceholderScreen({ title, description }: PlaceholderProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(title ?? '')}</Text>
      <Text style={styles.description}>{t(description ?? '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: PatientTheme.spaceXl,
    backgroundColor: PatientTheme.background,
  },
  title: {
    fontSize: PatientTheme.fontSizeTitle,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  description: {
    marginTop: PatientTheme.spaceSm,
    fontSize: PatientTheme.fontSizeBody,
    color: PatientTheme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
