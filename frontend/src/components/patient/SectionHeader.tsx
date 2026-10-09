import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  title: string;
  onSeeAllPress?: () => void;
};

export function SectionHeader({ title, onSeeAllPress }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t(title ?? '')}</Text>
      <Pressable
        onPress={onSeeAllPress}
        accessibilityRole="button"
        accessibilityLabel={t("See all {value0}", { value0: String(title) })}
        hitSlop={8}
      >
        <Text style={styles.seeAll}>{t("See All")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  seeAll: {
    color: PatientTheme.brand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '600',
  },
});
