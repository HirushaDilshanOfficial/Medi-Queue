import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'danger';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  iconName,
  iconColor,
  variant = 'default',
  onPress,
  style,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: Colors.tint,
          border: Colors.border,
          accent: Colors.primary,
          valColor: Colors.primary,
        };
      case 'warning':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          accent: Colors.warning,
          valColor: '#B45309',
        };
      case 'success':
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          accent: Colors.success,
          valColor: '#047857',
        };
      case 'danger':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          accent: Colors.danger,
          valColor: '#B91C1C',
        };
      default:
        return {
          bg: Colors.cardBackground,
          border: Colors.border,
          accent: Colors.secondary,
          valColor: Colors.textDark,
        };
    }
  };

  const currentVariant = getVariantStyles();
  const effectiveIconColor = iconColor || currentVariant.accent;

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: currentVariant.bg,
          borderColor: currentVariant.border,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {iconName && (
          <View style={styles.iconWrap}>
            <Ionicons name={iconName} size={18} color={effectiveIconColor} />
          </View>
        )}
      </View>

      <Text style={[styles.value, { color: currentVariant.valColor }]}>
        {value}
      </Text>

      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    minHeight: 44,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    minHeight: 90,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMedium,
    flex: 1,
    marginRight: 6,
  },
  iconWrap: {
    padding: 2,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default StatCard;
