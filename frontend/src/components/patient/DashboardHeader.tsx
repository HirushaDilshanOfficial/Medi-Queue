import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  activeDoctors: number;
  onBellPress?: () => void;
  onProfilePress?: () => void;
  avatarInitial: string;
};

export function DashboardHeader({
  activeDoctors,
  onBellPress,
  onProfilePress,
  avatarInitial,
}: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.root}>
      <DesignImage name="medical" size={30} color={PatientTheme.accent} style={styles.logo} />
      <View style={styles.titles}>
        <Text style={styles.eyebrow}>{t("NATIONAL OPD")}</Text>
        <Text style={styles.title}>{t("Home Dashboard")}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{activeDoctors} online</Text>
        </View>

        <Pressable
          onPress={onBellPress}
          accessibilityRole="button"
          accessibilityLabel={t("Notifications")}
          hitSlop={8}
          style={styles.iconButton}
        >
          <DesignImage name="bell" size={20} color={PatientTheme.brand} />
        </Pressable>

        <Pressable
          onPress={onProfilePress}
          accessibilityRole="button"
          accessibilityLabel={t("Open profile")}
          hitSlop={8}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: PatientTheme.spaceMd,
  },
  logo: {
    marginRight: PatientTheme.spaceMd,
  },
  titles: {
    flex: 1,
  },
  eyebrow: {
    color: PatientTheme.brandMid,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    marginTop: 2,
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 4,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.successSoft,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PatientTheme.success,
  },
  onlineText: {
    color: PatientTheme.success,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.surface,
    borderWidth: 1,
    borderColor: PatientTheme.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PatientTheme.brand,
    // Asiri rings avatars in the teal accent.
    borderWidth: 2,
    borderColor: PatientTheme.accent,
  },
  avatarText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.body,
    fontWeight: '800',
  },
});
