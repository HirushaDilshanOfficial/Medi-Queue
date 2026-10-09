import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LocalizedText as Text } from '../i18n/LocalizedText';
import { Colors } from '../constants/Colors';
import { QueuePriority } from '../types';

export interface TokenBadgeProps {
  tokenLabel: string;
  priority?: QueuePriority | string;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  tokenLabel,
  priority = 'normal',
  size = 'medium',
  onPress,
  style,
}) => {
  const getPriorityTheme = () => {
    switch (priority) {
      case 'urgent':
        return {
          bg: '#FEE2E2',
          text: '#DC2626',
          border: '#FCA5A5',
        };
      case 'senior':
        return {
          bg: '#FEF3C7',
          text: '#D97706',
          border: '#FCD34D',
        };
      default:
        return {
          bg: Colors.tint,
          text: Colors.primary,
          border: '#BAE6FD',
        };
    }
  };

  const theme = getPriorityTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 3,
          paddingHorizontal: 8,
          fontSize: 12,
          borderRadius: 6,
          minHeight: 24,
        };
      case 'large':
        return {
          paddingVertical: 8,
          paddingHorizontal: 16,
          fontSize: 20,
          borderRadius: 12,
          minHeight: 44,
        };
      default:
        return {
          paddingVertical: 5,
          paddingHorizontal: 12,
          fontSize: 15,
          borderRadius: 8,
          minHeight: 32,
        };
    }
  };

  const sizeStyle = getSizeStyles();

  const badge = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          borderRadius: sizeStyle.borderRadius,
          minHeight: sizeStyle.minHeight,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: theme.text,
            fontSize: sizeStyle.fontSize,
          },
        ]}
      >
        {tokenLabel}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {badge}
      </TouchableOpacity>
    );
  }

  return badge;
};

const styles = StyleSheet.create({
  touchable: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default TokenBadge;
