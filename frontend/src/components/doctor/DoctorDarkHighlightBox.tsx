import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { LinearGradient } from 'expo-linear-gradient';
import { DOCTOR_TOKENS as C } from './doctorTheme';

interface DoctorDarkHighlightBoxProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const DoctorDarkHighlightBox: React.FC<DoctorDarkHighlightBoxProps> = ({
  children,
  style,
}) => {
  return (
    <LinearGradient
      colors={[C.tealDeep, C.tealMid]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.box, style]}
    >
      {children}
    </LinearGradient>
  );
};

// Strong pill for "Clinic live" and "Active shift" inside the dark highlight box
// Dark translucent background (black at 24% opacity), mint #7CF0B8 text and mint dot or icon
export const DarkStrongPill: React.FC<{
  label: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ label, icon, pulse, onPress, style }) => {
  const content = (
    <View style={[styles.strongPill, style]}>
      {pulse && <View style={styles.mintPulseDot} />}
      <Text style={styles.strongPillText}>{label}</Text>
      {icon && <View style={{ marginLeft: 5 }}>{icon}</View>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// Translucent chip for actions like "Switch" inside the dark highlight box
// white 18% transparent background, white text, fully rounded, height 34
export const DarkTranslucentChip: React.FC<{
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ label, icon, onPress, style }) => {
  return (
    <TouchableOpacity
      style={[styles.translucentChip, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <View style={{ marginRight: 5 }}>{icon}</View>}
      <Text style={styles.translucentChipText}>{label}</Text>
    </TouchableOpacity>
  );
};

// Outline button inside the dark highlight box:
// white 16% transparent background, 1px white 40% border, white text, height 46, radius 14
export const DarkOutlineButton: React.FC<{
  title: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ title, icon, rightIcon, onPress, style }) => {
  return (
    <TouchableOpacity
      style={[styles.outlineBtn, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.outlineBtnInner}>
        {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
        <Text style={styles.outlineBtnText}>{title}</Text>
      </View>
      {rightIcon && <View style={{ marginLeft: 8 }}>{rightIcon}</View>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  box: {
    borderRadius: C.highlightBoxRadius,
    padding: 16,
    gap: 10,
    ...C.shadow,
  },
  strongPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.black24,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  mintPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.mint,
    marginRight: 6,
  },
  strongPillText: {
    color: C.mint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  translucentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white18,
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 34,
  },
  translucentChipText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white16,
    borderWidth: 1,
    borderColor: C.white40,
    minHeight: 46,
    paddingVertical: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  outlineBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  outlineBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
});
