import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function AddHospitalScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const hospitalTypes = [
    'National Hospital',
    'Teaching Hospital',
    'Provincial General',
    'District General',
    'Base Hospital',
    'Divisional Hospital'
  ];

  const predefinedClinics = [
    'General Medical', 'General Surgery', 'Orthopaedic', 'ENT', 'Eye', 
    'Cardiology', 'Neurology', 'Paediatric', 'Oncology', 'Dental', 
    'Gynaecology', 'Psychiatry', 'Diabetes'
  ];

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: '',
    contact: '',
    email: '',
    location: '',
    departments: [] as string[],
  });

  React.useEffect(() => {
    if (params.editHospitalData) {
      try {
        const hospital = JSON.parse(params.editHospitalData as string);
        setIsEditMode(true);
        setEditId(hospital._id);
        setFormData({
          name: hospital.name || '',
          code: hospital.code || '',
          type: hospital.type || '',
          contact: hospital.contact || '',
          email: hospital.email || '',
          location: hospital.location || '',
          departments: Array.isArray(hospital.departments) ? hospital.departments : 
                       (typeof hospital.departments === 'string' ? hospital.departments.split(',').map((d:string)=>d.trim()) : []),
        });
      } catch (error) {
        console.error('Failed to parse edit data', error);
      }
    }
  }, [params.editHospitalData]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    return /^(0)[0-9]{9}$/.test(phone);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.type || !formData.contact || !formData.email || !formData.location) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Please fill all required fields'), position: 'top', topOffset: 60 });
      return;
    }

    if (formData.name.trim().length < 3) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Hospital name is too short'), position: 'top', topOffset: 60 });
      return;
    }

    if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Hospital Name can only contain letters and spaces.'), position: 'top', topOffset: 60 });
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(formData.code)) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Hospital Code can only contain letters, numbers, and dashes.'), position: 'top', topOffset: 60 });
      return;
    }

    const contact = formData.contact.trim();
    if (!validatePhone(contact)) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Please enter a valid 10-digit phone number starting with 0.'), position: 'top', topOffset: 60 });
      return;
    }

    if (!validateEmail(formData.email.trim())) {
      Toast.show({ type: 'error', text1: t('Validation Error'), text2: t('Please enter a valid email address.'), position: 'top', topOffset: 60 });
      return;
    }
    
    setLoading(true);
    try {
      const url = isEditMode 
        ? `${API_URL}/hospitals/${editId}` 
        : `${API_URL}/hospitals/add`;
        
      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: isEditMode ? t('Hospital Updated') : t('Hospital Registered'),
          text2: isEditMode ? t('Hospital updated successfully!') : t('Hospital registered successfully!'),
          position: 'top',
          topOffset: 60,
        });
        router.back();
      } else {
        Toast.show({
          type: 'error',
          text1: t('Error'),
          text2: data.message || (isEditMode ? t('Failed to update hospital') : t('Failed to register hospital')),
          position: 'top',
          topOffset: 60,
        });
      }
    } catch (error) {
      console.error('Error adding hospital:', error);
      Toast.show({
        type: 'error',
        text1: t('Network Error'),
        text2: t('Network error. Please try again later.'),
        position: 'top',
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? t('Edit Hospital') : t('Add New Hospital')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>{t("Hospital Details")}</Text>
              <Text style={styles.sectionSubtitle}>{t("Enter the official information of the facility.")}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("Hospital Name")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("e.g. Colombo National Hospital")}
                  placeholderTextColor={Colors.textLight}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text.replace(/[^a-zA-Z\s]/g, '') })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>{t("Hospital Code")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("e.g. CNH-001")}
                    placeholderTextColor={Colors.textLight}
                    value={formData.code}
                    onChangeText={(text) => setFormData({ ...formData, code: text.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() })}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t("Hospital Type")}</Text>
                  <TouchableOpacity 
                    style={styles.dropdownButton}
                    onPress={() => setShowTypeDropdown(true)}
                  >
                    <Text style={{ color: formData.type ? Colors.textDark : Colors.textLight }}>
                      {t(formData.type) || t('Select Type')}
                    </Text>
                    <Text style={{ color: Colors.textMedium, fontSize: 12 }}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>{t("Location & Contact")}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("Address / Location")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("Enter full address")}
                  placeholderTextColor={Colors.textLight}
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("Contact Number")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("e.g. 0112345678")}
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                  value={formData.contact}
                  onChangeText={(text) => setFormData({ ...formData, contact: text.replace(/[^0-9]/g, '') })}
                  maxLength={10}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("Email Address")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("e.g. contact@hospital.com")}
                  placeholderTextColor={Colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text.replace(/\s/g, '') })}
                />
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>{t("Clinics / Departments")}</Text>
              <Text style={styles.sectionSubtitle}>{t("Select available clinics for this hospital.")}</Text>
              <View style={styles.chipsContainer}>
                {predefinedClinics.map((clinic) => {
                  const isSelected = formData.departments.includes(clinic);
                  return (
                    <TouchableOpacity
                      key={clinic}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        setFormData(prev => ({
                          ...prev,
                          departments: isSelected 
                            ? prev.departments.filter(d => d !== clinic)
                            : [...prev.departments, clinic]
                        }));
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {t(clinic)}
                      </Text>
                      {isSelected && <Text style={styles.chipCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.submitButtonText}>
              {loading 
                ? (isEditMode ? t('Updating...') : t('Registering...'))
                : (isEditMode ? t('Update Hospital') : t('Register Hospital'))}
            </Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showTypeDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTypeDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowTypeDropdown(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t("Select Hospital Type")}</Text>
              {hospitalTypes.map((type, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.modalOption}
                  onPress={() => {
                    setFormData({ ...formData, type });
                    setShowTypeDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    formData.type === type && styles.modalOptionTextActive
                  ]}>{t(type)}</Text>
                  {formData.type === type && <Text style={styles.modalOptionCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.textDark,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: Colors.white,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textDark,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 16,
    backgroundColor: '#f0f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d3eff2',
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.textMedium,
    fontWeight: '600',
    marginRight: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2f5ec',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  statusText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  submitButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  dropdownButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    width: '85%',
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 15,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalOptionText: {
    fontSize: 15,
    color: Colors.textDark,
  },
  modalOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalOptionCheck: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  chipCheck: {
    color: Colors.primary,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
});
