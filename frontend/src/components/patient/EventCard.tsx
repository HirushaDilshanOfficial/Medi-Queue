import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  image: ImageSourcePropType;
  title: string;
  description: string;
  schedule: string;
  badge?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EventCard({
  image,
  title,
  description,
  schedule,
  badge,
  onPress,
  style,
}: Props) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.root, style, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image source={image} style={styles.image} resizeMode="cover" />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {t(title ?? '')}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {t(description ?? '')}
        </Text>
        <Text style={styles.schedule} numberOfLines={1}>
          {schedule}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PatientTheme.surface,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    overflow: 'hidden',
    ...PatientTheme.shadowCard,
  },
  pressed: {
    opacity: 0.9,
  },
  imageWrap: {
    width: '100%',
    height: 104,
    backgroundColor: PatientTheme.surfaceCool,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: PatientTheme.spaceSm,
    left: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceSm,
    paddingVertical: 3,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: 'rgba(14,30,35,0.65)',
  },
  badgeText: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
  body: {
    padding: PatientTheme.spaceMd,
  },
  title: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.body,
    fontWeight: '800',
  },
  description: {
    marginTop: 2,
    color: PatientTheme.textSecondary,
    fontSize: PatientTheme.designType.caption,
    lineHeight: 15,
  },
  schedule: {
    marginTop: PatientTheme.spaceSm,
    color: PatientTheme.brand,
    fontSize: PatientTheme.designType.caption,
    fontWeight: '700',
  },
});
