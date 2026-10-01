import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../constants/PatientTheme';
import { DesignImage } from './DesignImage';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  action?: React.ReactNode;
};

// Header for the Part 2/3 screens, which are pushed without the native stack
// header so they can keep the dashboard's flat, borderless look.
export function ScreenHeader({ title, subtitle, showBack = false, action }: Props) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {showBack ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(patient)/doctors'))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <DesignImage name="arrow" size={18} style={styles.chevron} />
        </Pressable>
      ) : null}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceLg,
    paddingBottom: PatientTheme.spaceSm,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  chevron: {
    transform: [{ rotate: '180deg' }],
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  subtitle: {
    marginTop: 1,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
