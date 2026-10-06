import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/Colors';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  fullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'large',
  color = Colors.primary,
  fullscreen = false,
  style,
}) => {
  return (
    <View
      style={[
        styles.container,
        fullscreen ? styles.fullscreen : styles.inline,
        style,
      ]}
    >
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
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
    minHeight: 120,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMedium,
  },
});

export default LoadingState;
