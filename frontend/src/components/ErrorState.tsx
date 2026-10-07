import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  fullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'Unable to load data. Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
  fullscreen = false,
  style,
}) => {
  const { t } = useLanguage();
  return (
    <View
      style={[
        styles.container,
        fullscreen ? styles.fullscreen : styles.inline,
        style,
      ]}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle" size={32} color={Colors.danger} />
      </View>

      <Text style={styles.title}>{t(title ?? '')}</Text>
      {message ? <Text style={styles.message}>{t(message ?? '')}</Text> : null}

      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          style={styles.retryButton}
        >
          <Ionicons name="refresh" size={16} color={Colors.white} style={styles.retryIcon} />
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inline: {
    minHeight: 180,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    minWidth: 120,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  retryIcon: {
    marginRight: 6,
  },
  retryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ErrorState;
