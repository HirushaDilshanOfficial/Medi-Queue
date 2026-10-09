import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { DOCTOR_TOKENS as C } from './doctorTheme';

export const StatusPill = ({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) => {
  const { t } = useLanguage();
  return (
    <View style={[styles.statusPill, style]}>
      <View style={styles.statusDot} />
      <Text style={styles.statusPillText}>{t(label)}</Text>
    </View>
  );
};

export const SuccessPill = ({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) => {
  const { t } = useLanguage();
  return (
    <View style={[styles.successPill, style]}>
      <Text style={styles.successPillText}>{t(label)}</Text>
    </View>
  );
};

export const WarningPill = ({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) => {
  const { t } = useLanguage();
  return (
    <View style={[styles.warningPill, style]}>
      <Text style={styles.warningPillText}>{t(label)}</Text>
    </View>
  );
};

export const StrongPill = ({
  label,
  icon,
  pulse,
  onPress,
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { t } = useLanguage();
  const content = (
    <View style={[styles.strongPill, style]}>
      {pulse && <View style={styles.pulseDot} />}
      <Text style={styles.strongPillText}>{t(label)}</Text>
      {icon && <View style={styles.strongIconWrap}>{icon}</View>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export const ChipButton = ({
  label,
  icon,
  onPress,
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={[styles.chip, style]} activeOpacity={0.75} onPress={onPress}>
      {icon && <View style={{ marginRight: 5 }}>{icon}</View>}
      <Text style={styles.chipText}>{t(label)}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.teal,
  },
  statusPillText: {
    color: C.tealDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  successPill: {
    backgroundColor: C.okTint,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  successPillText: {
    color: C.ok,
    fontSize: 12,
    fontWeight: '700',
  },
  warningPill: {
    backgroundColor: C.warnTint,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warningPillText: {
    color: C.warn,
    fontSize: 12,
    fontWeight: '700',
  },
  strongPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ok,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  strongPillText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  strongIconWrap: {
    marginLeft: 6,
  },
  chip: {
    height: 34,
    borderRadius: 17,
    backgroundColor: C.tint,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: C.tealDeep,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
