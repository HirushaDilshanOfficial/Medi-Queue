import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage, type DesignImageName } from './DesignImage';

type Props = {
  title: string;
  badge: string | null;
  icon?: DesignImageName;
  onPress?: () => void;
};

export function CheckupRow({ title, badge, icon = 'calendar', onPress }: Props) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
          <DesignImage name={icon} size={16} color={PatientTheme.brand} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {t(title ?? '')}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
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
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surfaceMuted,
  },
  title: {
    flex: 1,
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.warningSoft,
  },
  badgeText: {
    color: PatientTheme.warning,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
});
