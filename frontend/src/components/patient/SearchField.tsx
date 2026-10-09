import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import {  StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  onPress?: () => void;
};

export function SearchField({ onPress }: Props) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={t("Search doctor or clinic")}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
          <DesignImage name="search" size={18} color={PatientTheme.textMuted} />
      <Text style={styles.placeholder}>{t("Search doctor or clinic")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceMd,
  },
  pressed: {
    opacity: 0.85,
  },
  placeholder: {
    color: PatientTheme.textMuted,
    fontSize: PatientTheme.designType.item,
  },
});
