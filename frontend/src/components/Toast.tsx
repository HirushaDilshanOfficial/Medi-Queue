import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useEffect, useRef } from 'react';
import {

  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number; // Duration in ms before auto-hiding (defaults to 2500ms)
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'success',
  duration = 2500,
  onDismiss,
  style,
}) => {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && message) {
      // Clear any pending timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Animate In
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after specified duration (2.5s default)
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      hideToast(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, message, duration]);

  const hideToast = (notifyDismiss: boolean = true) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (notifyDismiss && onDismiss) {
        onDismiss();
      }
    });
  };

  if (!visible && !message) {
    return null;
  }

  const getToastStyle = () => {
    switch (type) {
      case 'error':
        return {
          bg: '#991B1B',
          icon: 'alert-circle' as keyof typeof Ionicons.glyphMap,
        };
      case 'info':
        return {
          bg: '#0369A1',
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
        };
      case 'warning':
        return {
          bg: '#92400E',
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
        };
      case 'success':
      default:
        return {
          bg: '#065F46',
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
        };
    }
  };

  const currentType = getToastStyle();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: currentType.bg,
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
    >
      <Ionicons
        name={currentType.icon}
        size={20}
        color={Colors.white}
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={2}>
        {t(message ?? '')}
      </Text>
      <TouchableOpacity
        onPress={() => hideToast(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={18} color={Colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 2,
  },
});

export default Toast;
