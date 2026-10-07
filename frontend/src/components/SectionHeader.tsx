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

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onActionPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionText,
  onActionPress,
  actionIcon,
  rightElement,
  style,
}) => {
  const { t } = useLanguage();
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{t(title ?? '')}</Text>
        {subtitle ? <Text style={styles.subtitle}>{t(subtitle ?? '')}</Text> : null}
      </View>

      {rightElement ? (
        rightElement
      ) : onActionPress && (actionText || actionIcon) ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          style={styles.actionButton}
        >
          {actionText ? (
            <Text style={styles.actionText}>{actionText}</Text>
          ) : null}
          {actionIcon ? (
            <Ionicons
              name={actionIcon}
              size={16}
              color={Colors.primary}
              style={actionText ? styles.actionIconWithText : undefined}
            />
          ) : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 4,
  },
  titleWrap: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionIconWithText: {
    marginLeft: 4,
  },
});

export default SectionHeader;
