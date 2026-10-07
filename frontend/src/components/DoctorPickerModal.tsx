import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Doctor, QueueToken } from '../types';
import { getDoctors, assignDoctor, getErrorMessage } from '../services/api';

export interface DoctorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  token: QueueToken | null;
  department?: string;
  onSuccess?: (doctor: Doctor, tokenLabel: string) => void;
  onError?: (error: string) => void;
}

export const DoctorPickerModal: React.FC<DoctorPickerModalProps> = ({
  visible,
  onClose,
  token,
  department,
  onSuccess,
  onError,
}) => {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [assigningDoctorId, setAssigningDoctorId] = useState<string | null>(null);
  const isMounted = useRef<boolean>(true);

  // Fetch doctors whenever modal becomes visible
  useEffect(() => {
    isMounted.current = true;

    if (visible && token) {
      const fetchAvailableDoctors = async () => {
        try {
          setLoading(true);
          const dept = department || token.department;
          const data = await getDoctors(dept);
          if (isMounted.current) {
            // Filter active doctors or show list
            const activeDocs = (data || []).filter(
              (doc) => doc.status === 'active' || !doc.status
            );
            setDoctors(activeDocs.length > 0 ? activeDocs : data || []);
          }
        } catch (err: any) {
          if (isMounted.current) {
            setDoctors([]);
            const msg = getErrorMessage(err);
            onError?.(msg || 'Failed to load doctors list');
          }
        } finally {
          if (isMounted.current) {
            setLoading(false);
          }
        }
      };

      fetchAvailableDoctors();
    } else {
      setDoctors([]);
      setAssigningDoctorId(null);
    }

    return () => {
      isMounted.current = false;
    };
  }, [visible, token, department]);

  const handleSelectDoctor = async (doc: Doctor) => {
    if (!token || assigningDoctorId) return;
    const docId = doc._id || doc.id;
    if (!docId) return;

    try {
      setAssigningDoctorId(docId);
      const tokenId = token._id || token.tokenLabel || `${token.tokenNumber}`;
      await assignDoctor(tokenId, docId);

      const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;
      onClose();
      onSuccess?.(doc, tokenLabel);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      onError?.(msg || 'Failed to assign doctor');
    } finally {
      if (isMounted.current) {
        setAssigningDoctorId(null);
      }
    }
  };

  if (!visible || !token) return null;

  const patientObj =
    typeof token.patient === 'object' && token.patient !== null ? token.patient : null;
  const patientName =
    patientObj?.fullName || (patientObj as any)?.name || `Patient #${token.tokenNumber}`;
  const tokenLabel = token.tokenLabel || `OPD-${token.tokenNumber}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Top drag handle indicator */}
              <View style={styles.dragHandle} />

              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.title}>{t("Assign / Change Doctor")}</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {t("Token")}{' '}{tokenLabel} • {patientName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={Colors.textMedium} />
                </TouchableOpacity>
              </View>

              {/* Doctors Content */}
              {loading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loaderText}>{t("Loading active doctors...")}</Text>
                </View>
              ) : doctors.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="medkit-outline" size={32} color={Colors.textLight} />
                  </View>
                  <Text style={styles.emptyTitle}>{t("No Active Doctors Available")}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t("There are currently no active doctors scheduled in this department.")}</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.docList}
                  contentContainerStyle={styles.docListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {doctors.map((doc) => {
                    const docId = doc._id || doc.id || '';
                    const isCurrent =
                      typeof token.assignedDoctor === 'object' && token.assignedDoctor !== null
                        ? (token.assignedDoctor as any)?._id === docId
                        : token.assignedDoctor === docId;
                    const isAssigning = assigningDoctorId === docId;
                    const displayName = doc.name.startsWith('Dr.')
                      ? doc.name
                      : `Dr. ${doc.name}`;
                    const roomText = doc.room ? `Room ${doc.room}` : 'OPD Room';

                    return (
                      <TouchableOpacity
                        key={docId}
                        style={[
                          styles.docItem,
                          isCurrent && styles.docItemCurrent,
                          isAssigning && styles.docItemAssigning,
                        ]}
                        onPress={() => handleSelectDoctor(doc)}
                        disabled={!!assigningDoctorId}
                        activeOpacity={0.7}
                      >
                        {/* Doctor Icon Box */}
                        <View
                          style={[
                            styles.docIconBox,
                            isCurrent && styles.docIconBoxCurrent,
                          ]}
                        >
                          <Ionicons
                            name="medical"
                            size={18}
                            color={isCurrent ? Colors.success : Colors.primary}
                          />
                        </View>

                        {/* Doctor Info */}
                        <View style={styles.docInfo}>
                          <View style={styles.docNameRow}>
                            <Text style={styles.docName} numberOfLines={1}>
                              {displayName}
                            </Text>
                            {isCurrent ? (
                              <View style={styles.currentBadge}>
                                <Text style={styles.currentBadgeText}>{t("Currently Assigned")}</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.docMetaRow}>
                            <Text style={styles.docDept} numberOfLines={1}>
                              {doc.department || doc.specialization || t('General OPD')}
                            </Text>
                            <Text style={styles.docMetaDot}>•</Text>
                            <View style={styles.roomBadge}>
                              <Ionicons
                                name="location-outline"
                                size={11}
                                color={Colors.textMedium}
                                style={{ marginRight: 3 }}
                              />
                              <Text style={styles.roomText}>{roomText}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Right Action / Indicator */}
                        {isAssigning ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <View
                            style={[
                              styles.selectCircle,
                              isCurrent && styles.selectCircleCurrent,
                            ]}
                          >
                            <Ionicons
                              name={isCurrent ? 'checkmark' : 'chevron-forward'}
                              size={16}
                              color={isCurrent ? Colors.white : Colors.textLight}
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 30, 35, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMedium,
    marginTop: 2,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  emptyWrap: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  docList: {
    marginTop: 12,
  },
  docListContent: {
    paddingBottom: 12,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
    backgroundColor: Colors.cardBackground,
    minHeight: 56, // $\ge 44$px touch target
  },
  docItemCurrent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  docItemAssigning: {
    opacity: 0.7,
  },
  docIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docIconBoxCurrent: {
    backgroundColor: '#DCFCE7',
  },
  docInfo: {
    flex: 1,
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  docName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginRight: 6,
  },
  currentBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  docDept: {
    fontSize: 12,
    color: Colors.textMedium,
    fontWeight: '500',
  },
  docMetaDot: {
    fontSize: 12,
    color: Colors.textLight,
    marginHorizontal: 5,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomText: {
    fontSize: 12,
    color: Colors.textMedium,
    fontWeight: '600',
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectCircleCurrent: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
});

export default DoctorPickerModal;
