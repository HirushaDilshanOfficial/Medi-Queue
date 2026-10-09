import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  TextStyle,
  View,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { DOCTOR_TOKENS as C } from './doctorTheme';

interface ButtonProps {
  label?: string;
  title?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const PrimaryButton = ({
  label,
  title,
  onPress,
  icon,
  iconRight,
  rightIcon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) => {
  const text = title || label || '';
  const right = rightIcon || iconRight;

  return (
    <TouchableOpacity
      style={[styles.baseBtn, styles.primaryBtn, disabled && styles.disabledBtn, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.btnText, styles.primaryText, textStyle]} numberOfLines={1}>{text}</Text>
          {right && <View style={styles.iconRight}>{right}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

export const SecondaryButton = ({
  label,
  title,
  onPress,
  icon,
  iconRight,
  rightIcon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) => {
  const text = title || label || '';
  const right = rightIcon || iconRight;

  return (
    <TouchableOpacity
      style={[styles.baseBtn, styles.secondaryBtn, disabled && styles.disabledBtn, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.tealDeep} />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.btnText, styles.secondaryText, textStyle]} numberOfLines={1}>{text}</Text>
          {right && <View style={styles.iconRight}>{right}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

export const OutlineButton = ({
  label,
  title,
  onPress,
  icon,
  iconRight,
  rightIcon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) => {
  const text = title || label || '';
  const right = rightIcon || iconRight;

  return (
    <TouchableOpacity
      style={[styles.baseBtn, styles.outlineBtn, disabled && styles.disabledBtn, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.tealDeep} />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.btnText, styles.outlineText, textStyle]} numberOfLines={1}>{text}</Text>
          {right && <View style={styles.iconRight}>{right}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseBtn: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: C.teal,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: C.tint,
  },
  secondaryText: {
    color: C.tealDeep,
  },
  outlineBtn: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.teal,
  },
  outlineText: {
    color: C.tealDeep,
  },
  disabledBtn: {
    opacity: 0.55,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
