import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useWalkInForm } from '../../hooks/useWalkInForm';
import { searchPatients, getErrorMessage } from '../../services/api';
import { Patient, QueuePriority, AppointmentType } from '../../types';
import { Toast, ToastType } from '../../components/Toast';

export interface RegisterPatientScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const RegisterPatientScreen: React.FC<RegisterPatientScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const form = useWalkInForm();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [matchedPatient, setMatchedPatient] = useState<Patient | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('info');

  const showToast = (message: string, type: ToastType = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // 400ms Debounced Patient Search by NIC or Phone
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setSearchStatus('idle');
        setMatchedPatient(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const res = await searchPatients(trimmed);
        if (res?.found && res?.patients?.length > 0) {
          const patient = res.patients[0];
          setMatchedPatient(patient);
          setSearchStatus('found');

          // Auto-fill form and record existing patient ID
          form.setExistingPatient(patient._id, {
            fullName: patient.fullName || '',
            nic: patient.nic || '',
            phone: patient.phone || '',
            age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
            gender: (patient.gender as any) || '',
          });

          showToast('Existing patient record found & auto-filled', 'success');
        } else {
          setMatchedPatient(null);
          setSearchStatus('not_found');
          form.setExistingPatient(null);

          // If query looks like an NIC, pre-fill NIC field; if phone, pre-fill phone
          if (/^\d{9}[VXvx]?$|^\d{12}$/.test(trimmed)) {
            form.setField('nic', trimmed);
          } else if (/^(?:\+?94|0)\d+$/.test(trimmed)) {
            form.setField('phone', trimmed);
          }
        }
      } catch (err: any) {
        setSearchStatus('idle');
        const msg = getErrorMessage(err);
        showToast(msg || 'Search failed', 'error');
      } finally {
        setSearching(false);
      }
    },
    [form]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    form.setField('query', text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        executeSearch(text);
      }, 400);
    } else {
      setSearchStatus('idle');
      setMatchedPatient(null);
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchQuery('');
    setSearchStatus('idle');
    setMatchedPatient(null);
    setSearching(false);
    form.reset();
  };

  const handleQRScanPress = () => {
    showToast('QR Code scanning coming soon', 'info');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── TOAST BANNER ── */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2500}
        onDismiss={() => setToastVisible(false)}
      />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badgeWrap}>
            <Ionicons name="person-add" size={12} color={Colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>INTAKE DESK</Text>
          </View>
          <Text style={styles.headerTitle}>Patient Registration</Text>
          <Text style={styles.headerSubtitle}>Step 1 of 2: Patient Identification & Details</Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleClearSearch}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── SEARCH BAR (NIC / PHONE / QR) ── */}
          <View style={styles.searchCard}>
            <Text style={styles.searchTitle}>Search Existing Record</Text>
            <Text style={styles.searchDesc}>
              Enter Patient NIC or Phone Number to check past hospital visits.
            </Text>

            <View style={styles.searchBarRow}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={18} color={Colors.textLight} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="NIC (e.g. 199418201234 / 647891234V) or Phone"
                  placeholderTextColor={Colors.textLight}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  clearButtonMode="never"
                />

                {searching ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={styles.searchSpinner} />
                ) : searchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={handleClearSearch}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.clearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* QR Scanner Icon Button */}
              <TouchableOpacity
                style={styles.qrButton}
                onPress={handleQRScanPress}
                activeOpacity={0.7}
                accessibilityLabel="Scan Patient QR Code"
              >
                <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* ── SEARCH STATUS BANNERS ── */}
            {searchStatus === 'found' && matchedPatient && (
              <View style={styles.foundBanner}>
                <View style={styles.bannerIconCircleSuccess}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                </View>
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.foundBannerTitle}>Existing record found (auto-filled)</Text>
                  <Text style={styles.foundBannerSub}>
                    Patient: {matchedPatient.fullName} • Reg: {matchedPatient.registeredVia || 'Hospital'}
                  </Text>
                </View>
              </View>
            )}

            {searchStatus === 'not_found' && (
              <View style={styles.notFoundBanner}>
                <View style={styles.bannerIconCircleInfo}>
                  <Ionicons name="person-add" size={16} color={Colors.primary} />
                </View>
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.notFoundBannerTitle}>New patient</Text>
                  <Text style={styles.notFoundBannerSub}>
                    No previous record found. Please enter details below.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── STEP 1: PATIENT DEMOGRAPHICS FORM ── */}
          <View style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>STEP 1</Text>
              </View>
              <Text style={styles.formCardTitle}>Patient Information</Text>
            </View>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  form.errors.fullName ? styles.inputError : null,
                ]}
                placeholder="e.g. Kasun Chamara Mendis"
                placeholderTextColor={Colors.textLight}
                value={form.patient.fullName}
                onChangeText={(val) => form.setField('fullName', val)}
                autoCapitalize="words"
              />
              {form.errors.fullName ? (
                <Text style={styles.errorText}>{form.errors.fullName}</Text>
              ) : null}
            </View>

            {/* NIC & Phone Row */}
            <View style={styles.fieldsRow}>
              {/* NIC Field */}
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>NIC (Optional)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    form.errors.nic ? styles.inputError : null,
                  ]}
                  placeholder="199418201234 / 647891234V"
                  placeholderTextColor={Colors.textLight}
                  value={form.patient.nic}
                  onChangeText={(val) => form.setField('nic', val)}
                  autoCapitalize="characters"
                />
                {form.errors.nic ? (
                  <Text style={styles.errorText}>{form.errors.nic}</Text>
                ) : null}
              </View>

              {/* Phone Field */}
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>
                  Phone Number <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    form.errors.phone ? styles.inputError : null,
                  ]}
                  placeholder="0771234567"
                  placeholderTextColor={Colors.textLight}
                  value={form.patient.phone}
                  onChangeText={(val) => form.setField('phone', val)}
                  keyboardType="phone-pad"
                />
                {form.errors.phone ? (
                  <Text style={styles.errorText}>{form.errors.phone}</Text>
                ) : null}
              </View>
            </View>

            {/* Age & Gender Row */}
            <View style={styles.fieldsRow}>
              {/* Age Field */}
              <View style={[styles.fieldGroup, { flex: 0.8, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    form.errors.age ? styles.inputError : null,
                  ]}
                  placeholder="e.g. 32"
                  placeholderTextColor={Colors.textLight}
                  value={String(form.patient.age || '')}
                  onChangeText={(val) => form.setField('age', val)}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                {form.errors.age ? (
                  <Text style={styles.errorText}>{form.errors.age}</Text>
                ) : null}
              </View>

              {/* Gender Select */}
              <View style={[styles.fieldGroup, { flex: 1.2, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {(['male', 'female', 'other'] as const).map((g) => {
                    const isSelected = form.patient.gender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderChip,
                          isSelected ? styles.genderChipSelected : null,
                        ]}
                        onPress={() => form.setField('gender', g)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.genderChipText,
                            isSelected ? styles.genderChipTextSelected : null,
                          ]}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Priority Select */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Queue Priority</Text>
              <View style={styles.priorityRow}>
                {[
                  { key: 'normal', label: 'Normal', icon: 'person' },
                  { key: 'senior', label: 'Senior Citizen', icon: 'heart' },
                  { key: 'urgent', label: 'Urgent Priority', icon: 'warning' },
                ].map((item) => {
                  const isSelected = form.priority === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.priorityChip,
                        isSelected ? styles.priorityChipSelected : null,
                        item.key === 'urgent' && isSelected ? styles.priorityUrgentSelected : null,
                        item.key === 'senior' && isSelected ? styles.prioritySeniorSelected : null,
                      ]}
                      onPress={() => form.setField('priority', item.key as QueuePriority)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={14}
                        color={
                          isSelected
                            ? item.key === 'urgent'
                              ? Colors.danger
                              : item.key === 'senior'
                              ? Colors.warning
                              : Colors.primary
                            : Colors.textMedium
                        }
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.priorityChipText,
                          isSelected ? styles.priorityChipTextSelected : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Intake Type Select */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Intake Type</Text>
              <View style={styles.intakeTypeRow}>
                {[
                  { key: 'walk_in', label: 'Walk-In Patient', icon: 'walk' },
                  { key: 'pre_booked', label: 'Pre-Booked Appointment', icon: 'calendar' },
                ].map((item) => {
                  const isSelected = form.intakeType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.intakeTypeChip,
                        isSelected ? styles.intakeTypeChipSelected : null,
                      ]}
                      onPress={() => form.setField('intakeType', item.key as AppointmentType)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={15}
                        color={isSelected ? Colors.primary : Colors.textMedium}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.intakeTypeChipText,
                          isSelected ? styles.intakeTypeChipTextSelected : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 10,
    paddingBottom: 16,
    backgroundColor: Colors.primary,
  },
  headerLeft: {
    flex: 1,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    fontWeight: '500',
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    padding: 16,
  },
  searchCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  searchDesc: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 3,
    marginBottom: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textDark,
    paddingVertical: 10,
    fontWeight: '600',
  },
  searchSpinner: {
    marginLeft: 6,
  },
  clearBtn: {
    padding: 4,
  },
  qrButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.tint,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  foundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bannerIconCircleSuccess: {
    marginRight: 10,
  },
  bannerTextWrap: {
    flex: 1,
  },
  foundBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  foundBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bannerIconCircleInfo: {
    marginRight: 10,
  },
  notFoundBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  notFoundBannerSub: {
    fontSize: 11,
    color: '#1D4ED8',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  stepPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  formCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textDark,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: Colors.danger,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textDark,
    minHeight: 46,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginHorizontal: 2,
    minHeight: 46,
  },
  genderChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  genderChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    minHeight: 44,
  },
  priorityChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  priorityUrgentSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: Colors.danger,
  },
  prioritySeniorSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: Colors.warning,
  },
  priorityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  priorityChipTextSelected: {
    fontWeight: '800',
    color: Colors.textDark,
  },
  intakeTypeRow: {
    flexDirection: 'row',
  },
  intakeTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 11,
    paddingHorizontal: 6,
    marginHorizontal: 3,
    minHeight: 44,
  },
  intakeTypeChipSelected: {
    backgroundColor: Colors.tint,
    borderColor: Colors.primary,
  },
  intakeTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  intakeTypeChipTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
});

export default RegisterPatientScreen;
