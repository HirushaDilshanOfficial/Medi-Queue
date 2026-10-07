import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Patient, Allergy } from '../types';
import { updatePatient, getErrorMessage } from '../services/api';
import { isValidSLPhone, normalizePhone } from '../utils/validations';
import { Toast, ToastType } from './Toast';

export interface EditPatientModalProps {
  visible: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSuccess?: (updatedPatient: Patient) => void;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEVERITIES = ['Mild', 'Moderate', 'Severe', 'High'];
const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Guardian', 'Other'];

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  visible,
  patient,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  // Form State
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState<string>('');

  // Emergency Contact State
  const [emName, setEmName] = useState<string>('');
  const [emRelationship, setEmRelationship] = useState<string>('');
  const [emPhone, setEmPhone] = useState<string>('');

  // Allergies State
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [newAllergyName, setNewAllergyName] = useState<string>('');
  const [newAllergySeverity, setNewAllergySeverity] = useState<string>('Moderate');

  // UI / Status State
  const [saving, setSaving] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emPhoneError, setEmPhoneError] = useState<string | null>(null);

  // Internal Toast State
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Populate form fields when patient prop changes or modal becomes visible
  useEffect(() => {
    if (patient && visible) {
      setPhone(patient.phone || '');
      setAddress(patient.address || '');
      setDistrict(patient.district || '');
      setBloodGroup(patient.bloodGroup || '');

      setEmName(patient.emergencyContact?.name || '');
      setEmRelationship(patient.emergencyContact?.relationship || '');
      setEmPhone(patient.emergencyContact?.phone || '');

      setAllergies(patient.allergies ? [...patient.allergies] : []);
      setNewAllergyName('');
      setNewAllergySeverity('Moderate');
      setPhoneError(null);
      setEmPhoneError(null);
    }
  }, [patient, visible]);

  const handleAddAllergy = () => {
    const trimmed = newAllergyName.trim();
    if (!trimmed) return;

    // Avoid duplicate names
    if (allergies.some((a) => a.name?.toLowerCase() === trimmed.toLowerCase())) {
      showToast(t('Allergy is already in the list'), 'warning');
      return;
    }

    setAllergies([...allergies, { name: trimmed, severity: newAllergySeverity }]);
    setNewAllergyName('');
    setNewAllergySeverity('Moderate');
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const patientId = patient?._id || patient?.id;
    if (!patientId || saving) return;

    // 1. Phone validation
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setPhoneError('Primary phone number is required');
      showToast(t('Phone number is required'), 'error');
      return;
    }

    if (!isValidSLPhone(trimmedPhone)) {
      setPhoneError('Invalid SL phone number format (e.g. 0771234567)');
      showToast(t('Please enter a valid Sri Lankan phone number'), 'error');
      return;
    }
    setPhoneError(null);

    // 2. Emergency phone validation (optional, but must be valid if provided)
    const trimmedEmPhone = emPhone.trim();
    if (trimmedEmPhone && !isValidSLPhone(trimmedEmPhone)) {
      setEmPhoneError('Invalid emergency phone format (e.g. 0719876543)');
      showToast(t('Please enter a valid emergency contact phone'), 'error');
      return;
    }
    setEmPhoneError(null);

    try {
      setSaving(true);

      // Only send the editable fields
      const payload: Partial<Patient> = {
        phone: normalizePhone(trimmedPhone) || trimmedPhone,
        address: address.trim(),
        district: district.trim(),
        bloodGroup: bloodGroup ? (bloodGroup as any) : null,
        emergencyContact: {
          name: emName.trim(),
          relationship: emRelationship.trim(),
          phone: trimmedEmPhone ? normalizePhone(trimmedEmPhone) || trimmedEmPhone : '',
        },
        allergies: allergies.map((a) => ({
          name: a.name?.trim() || '',
          severity: a.severity || 'Moderate',
        })),
      };

      const res = await updatePatient(patientId, payload);
      showToast(res.message || t('Patient details updated successfully'), 'success');

      if (onSuccess && res.patient) {
        onSuccess(res.patient);
      }

      // Close modal after brief delay or callback
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      showToast(msg || t('Failed to update patient details'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        {/* Toast for internal feedback */}
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          duration={2200}
          onDismiss={() => setToastVisible(false)}
        />

        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{t("Update Patient Details")}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {patient?.fullName || t('Patient Profile')}
                  {patient?.nic ? t(" • NIC: {value0}", { value0: String(patient.nic) }) : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Close modal")}
            >
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.modalFormScroll}
            contentContainerStyle={styles.modalFormScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── SECTION 1: PRIMARY CONTACT & LOCATION ── */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>{t("Contact & Location")}</Text>

              {/* Phone Field */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{t("Primary Phone *")}</Text>
                  {phoneError ? (
                    <Text style={styles.inputErrorText}>{phoneError}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.inputWrapper,
                    phoneError ? styles.inputWrapperError : null,
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={phoneError ? Colors.danger : Colors.textMedium}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="e.g. 0771234567"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>

              {/* District Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("District")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={Colors.textMedium}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={district}
                    onChangeText={setDistrict}
                    placeholder={t("e.g. Colombo / Gampaha / Kandy")}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              {/* Address Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("Home / Street Address")}</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <Ionicons
                    name="home-outline"
                    size={16}
                    color={Colors.textMedium}
                    style={[styles.inputLeadingIcon, { marginTop: 10 }]}
                  />
                  <TextInput
                    style={[styles.textInput, styles.textAreaInput]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t("e.g. No. 45, Temple Road, Colombo 03")}
                    placeholderTextColor={Colors.textLight}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>
            </View>

            {/* ── SECTION 2: MEDICAL PROFILE ── */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>{t("Medical Profile")}</Text>

              {/* Blood Group */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("Blood Group")}</Text>
                <View style={styles.bloodChipsGrid}>
                  {BLOOD_GROUPS.map((bg) => {
                    const isSelected = bloodGroup === bg;
                    return (
                      <TouchableOpacity
                        key={bg}
                        style={[
                          styles.bloodChip,
                          isSelected && styles.bloodChipSelected,
                        ]}
                        onPress={() => setBloodGroup(isSelected ? '' : bg)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t("Blood group {value0}", { value0: String(bg) })}
                      >
                        <Text
                          style={[
                            styles.bloodChipText,
                            isSelected && styles.bloodChipTextSelected,
                          ]}
                        >
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Allergies */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("Known Allergies")}</Text>

                {/* Existing Allergy Chips */}
                {allergies.length > 0 ? (
                  <View style={styles.allergyTagList}>
                    {allergies.map((alg, index) => (
                      <View key={`allergy-${index}`} style={styles.allergyTag}>
                        <Ionicons
                          name="warning"
                          size={12}
                          color="#DC2626"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.allergyTagText}>
                          {alg.name} {alg.severity ? `(${alg.severity})` : ''}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveAllergy(index)}
                          style={styles.allergyRemoveButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={15} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noAllergiesHint}>
                    {t("No allergies currently recorded.")}</Text>
                )}

                {/* Add New Allergy Row */}
                <View style={styles.addAllergyBox}>
                  <View style={styles.addAllergyInputRow}>
                    <TextInput
                      style={styles.allergyTextInput}
                      value={newAllergyName}
                      onChangeText={setNewAllergyName}
                      placeholder={t("Add allergy (e.g. Penicillin, Aspirin)")}
                      placeholderTextColor={Colors.textLight}
                    />
                    <TouchableOpacity
                      style={[
                        styles.addAllergyButton,
                        !newAllergyName.trim() && styles.buttonDisabled,
                      ]}
                      onPress={handleAddAllergy}
                      disabled={!newAllergyName.trim()}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={Colors.white} />
                      <Text style={styles.addAllergyButtonText}>{t("Add")}</Text>
                    </TouchableOpacity>
                  </View>

                  {newAllergyName.trim().length > 0 ? (
                    <View style={styles.severitySelectorRow}>
                      <Text style={styles.severityHelperLabel}>{t("Severity:")}</Text>
                      {SEVERITIES.map((sev) => {
                        const isSelected = newAllergySeverity === sev;
                        return (
                          <TouchableOpacity
                            key={sev}
                            style={[
                              styles.severityChip,
                              isSelected && styles.severityChipSelected,
                            ]}
                            onPress={() => setNewAllergySeverity(sev)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.severityChipText,
                                isSelected && styles.severityChipTextSelected,
                              ]}
                            >
                              {sev}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* ── SECTION 3: EMERGENCY CONTACT ── */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>{t("Emergency Contact")}</Text>

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("Contact Person Name")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={Colors.textMedium}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={emName}
                    onChangeText={setEmName}
                    placeholder="e.g. Nimal Perera"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              {/* Relationship Chips */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("Relationship")}</Text>
                <View style={styles.relationshipChipsGrid}>
                  {RELATIONSHIPS.map((rel) => {
                    const isSelected = emRelationship === rel;
                    return (
                      <TouchableOpacity
                        key={rel}
                        style={[
                          styles.relChip,
                          isSelected && styles.relChipSelected,
                        ]}
                        onPress={() =>
                          setEmRelationship(isSelected ? '' : rel)
                        }
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.relChipText,
                            isSelected && styles.relChipTextSelected,
                          ]}
                        >
                          {rel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Emergency Phone */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{t("Emergency Phone")}</Text>
                  {emPhoneError ? (
                    <Text style={styles.inputErrorText}>{emPhoneError}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.inputWrapper,
                    emPhoneError ? styles.inputWrapperError : null,
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={emPhoneError ? Colors.danger : Colors.textMedium}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={emPhone}
                    onChangeText={(t) => {
                      setEmPhone(t);
                      if (emPhoneError) setEmPhoneError(null);
                    }}
                    placeholder="e.g. 0719876543"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Modal Actions Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("Cancel edit")}
            >
              <Text style={styles.cancelButtonText}>{t("Cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("Save patient details")}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={Colors.white}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.saveButtonText}>{t("Save Details")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  // ── Scroll Content ──
  modalFormScroll: {
    paddingHorizontal: 20,
  },
  modalFormScrollContent: {
    paddingTop: 16,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // ── Inputs ──
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  inputErrorText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46, // 46px touch target
  },
  inputWrapperError: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDark,
    paddingVertical: 10,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    minHeight: 70,
  },
  textAreaInput: {
    minHeight: 50,
    textAlignVertical: 'top',
  },

  // ── Blood Group Chips ──
  bloodChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 44, // 44px touch target
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bloodChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textDark,
  },
  bloodChipTextSelected: {
    color: Colors.white,
  },

  // ── Allergies Management ──
  allergyTagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  allergyTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    marginRight: 4,
  },
  allergyRemoveButton: {
    padding: 2,
  },
  noAllergiesHint: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  addAllergyBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  addAllergyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allergyTextInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.textDark,
    minHeight: 40,
  },
  addAllergyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 40, // 40px touch target
    justifyContent: 'center',
  },
  addAllergyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
    marginLeft: 3,
  },
  severitySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  severityHelperLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  severityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  severityChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  severityChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  severityChipTextSelected: {
    color: Colors.white,
  },

  // ── Relationship Chips ──
  relationshipChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  relChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  relChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
  },
  relChipTextSelected: {
    color: Colors.white,
  },

  // ── Footer ──
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46, // 46px touch target
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMedium,
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    minHeight: 46, // 46px touch target
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default EditPatientModal;
