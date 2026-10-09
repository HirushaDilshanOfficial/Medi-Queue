import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LocalizedText as Text } from '../i18n/LocalizedText';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

export interface StatusChipProps {
  status: string;
  label?: string;
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = 'medium',
  style,
}) => {
  const { t } = useLanguage();
  const normalized = (status || '').toLowerCase().trim();

  const getStatusConfig = () => {
    switch (normalized) {
      case 'serving':
      case 'in_consultation':
      case 'consulting':
        return {
          bg: '#ECFDF5',
          text: '#047857',
          dot: '#10B981',
          defaultLabel: 'Serving',
        };
      case 'called':
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          dot: '#F59E0B',
          defaultLabel: 'Called',
        };
      case 'waiting':
      case 'checked_in':
      case 'booked':
      case 'available':
        return {
          bg: '#E0F2FE',
          text: '#0369A1',
          dot: '#0284C7',
          defaultLabel: 'Waiting',
        };
      case 'done':
      case 'completed':
      case 'active':
        return {
          bg: '#F0FDF4',
          text: '#15803D',
          dot: '#22C55E',
          defaultLabel: 'Completed',
        };
      case 'no_show':
      case 'cancelled':
      case 'inactive':
      case 'offline':
        return {
          bg: '#FEF2F2',
          text: '#B91C1C',
          dot: '#EF4444',
          defaultLabel: 'No Show',
        };
      case 'on_break':
      case 'on break':
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          dot: '#F59E0B',
          defaultLabel: 'On Break',
        };
      default:
        return {
          bg: Colors.background,
          text: Colors.textMedium,
          dot: Colors.textLight,
          defaultLabel: status,
        };
    }
  };

  const config = getStatusConfig();
  const displayText =
    label ||
    config.defaultLabel ||
    status.charAt(0).toUpperCase() + status.slice(1);

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: config.bg,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: isSmall ? 11 : 12,
          },
        ]}
      >
        {t(displayText)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default StatusChip;
