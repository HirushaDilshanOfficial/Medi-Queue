import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Patient } from '../types';

export interface PatientCardProps {
  patient: Patient;
  onPress?: () => void;
  onActionPress?: () => void;
  onEditPress?: () => void;
  actionLabel?: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  onPress,
  onActionPress,
  onEditPress,
  actionLabel,
  subtitle,
  rightElement,
  style,
}) => {
  const getInitials = (name: string): string => {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(patient.fullName);

  const cardContent = (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {patient.fullName}
            </Text>
            {patient.nicVerified ? (
              <MaterialIcons
                name="verified"
                size={16}
                color={Colors.primary}
                style={styles.verifiedIcon}
              />
            ) : null}
          </View>

          {subtitle ? (
            <Text style={styles.customSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            <View style={styles.metaRow}>
              {patient.nic ? (
                <Text style={styles.nicText}>NIC: {patient.nic}</Text>
              ) : null}
              {patient.age ? (
                <Text style={styles.bulletText}>• {patient.age} yrs</Text>
              ) : null}
              {patient.gender ? (
                <Text style={styles.bulletText}>
                  • {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={13} color={Colors.textLight} />
            <Text style={styles.phoneText}>{patient.phone}</Text>
            {patient.district ? (
              <Text style={styles.districtText}>| {patient.district}</Text>
            ) : null}
            {patient.bloodGroup ? (
              <View style={styles.bloodBadge}>
                <Text style={styles.bloodText}>{patient.bloodGroup}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {onEditPress ? (
          <TouchableOpacity
            onPress={onEditPress}
            style={styles.editIconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Edit patient details"
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}

        {rightElement ? (
          <View style={styles.rightWrapper}>{rightElement}</View>
        ) : onActionPress && actionLabel ? (
          <TouchableOpacity
            onPress={onActionPress}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : onPress ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.textLight}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  touchable: {
    minHeight: 44,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tint,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  mainInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  customSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  nicText: {
    fontSize: 12,
    color: Colors.textMedium,
    fontWeight: '600',
  },
  bulletText: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.textMedium,
    marginLeft: 4,
  },
  districtText: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 6,
  },
  bloodBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  bloodText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  rightWrapper: {
    marginLeft: 8,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 8,
  },
  editIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
});

export default PatientCard;
