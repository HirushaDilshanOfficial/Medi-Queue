import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function AddStaffScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState('');
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  // Date Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(new Date());
  
  // Dropdowns state
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false);
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false);
  
  const [hospitals, setHospitals] = useState<any[]>([]);

  const roles = ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Other'];
  const genders = ['Male', 'Female', 'Other'];
  const specializations = [
    'Eye', 'General Medicine', 'General Surgery', 'Cardiology', 
    'Chest', 'Psychiatry', 'Nephrology', 'Gynaecology', 'ENT', 
    'Diabetes', 'Dental', 'Paediatric', 'Dermatology', 'Urology',
    'Orthopedics', 'Neurology', 'Oncology', 'Other'
  ];

  const [formData, setFormData] = useState({
    fullName: '',
    nic: '',
    employeeNo: '',
    dob: '',
    gender: '',
    mobile: '',
    email: '',
    address: '',
    role: '',
    hospitalId: '',
    hospitalName: '',
    department: '',
    password: '',
    // Doctor Specific
    medRegNo: '',
    specialization: '',
    doctorQualification: '',
    // Nurse Specific
    nurseRegNo: '',
    nurseQualification: '',
    ward: '',
  });

  useEffect(() => {
    fetchHospitals();

    if (params.editStaffData) {
      try {
        const staff = JSON.parse(params.editStaffData as string);
        setIsEditMode(true);
        setEditId(staff._id);
        if (staff.dob) {
          setDate(new Date(staff.dob));
        }
        setFormData(prev => ({
          ...prev,
          ...staff,
          hospitalId: staff.hospital?._id || '',
          hospitalName: staff.hospital?.name || '',
        }));
      } catch (error) {
        console.error('Failed to parse edit data', error);
      }
    }
  }, [params.editStaffData]);

  const fetchHospitals = async () => {
    try {
      const response = await fetch(`${API_URL}/hospitals?status=Active`);
      const data = await response.json();
      setHospitals(data);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  // Auto-generate employee number when role changes (mock for frontend)
  const handleRoleSelect = (selectedRole: string) => {
    let prefix = 'EMP';
    if (selectedRole === 'Doctor') prefix = 'DOC';
    if (selectedRole === 'Nurse') prefix = 'NRS';
    if (selectedRole === 'Receptionist') prefix = 'REC';
    
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedEmpNo = `${prefix}-${randomNum}`;

    setFormData({ ...formData, role: selectedRole, employeeNo: generatedEmpNo });
    setShowRoleDropdown(false);
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.nic || !formData.email || !formData.role || !formData.hospitalId) {
      alert('Please fill all required fields (*)');
      return;
    }

    if (formData.role === 'Doctor') {
      if (!formData.medRegNo || !formData.specialization || !formData.doctorQualification) {
        Alert.alert(t('Missing Fields'), t('Please fill out all doctor details (*).'));
        return;
      }
    }
    
    if (formData.role === 'Nurse') {
      if (!formData.nurseRegNo || !formData.nurseQualification || !formData.ward) {
        Alert.alert(t('Missing Fields'), t('Please fill out all nurse details (*).'));
        return;
      }
    }
    
    setLoading(true);
    try {
      const url = isEditMode 
        ? `${API_URL}/staff/${editId}` 
        : `${API_URL}/staff/add`;
        
      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(isEditMode ? 'Staff updated successfully!' : 'Staff registered successfully!');
        router.back();
      } else {
        alert(data.message || (isEditMode ? 'Failed to update staff' : 'Failed to register staff'));
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('An error occurred. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      if (Platform.OS === 'android') {
        const formattedDate = selectedDate.toISOString().split('T')[0];
        setFormData({ ...formData, dob: formattedDate });
      }
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    return /^(0)[0-9]{9}$/.test(phone);
  };

  const validateNIC = (nic: string) => {
    return /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(nic);
  };

  const validateName = (name: string) => {
    return /^[a-zA-Z\s.]+$/.test(name);
  };

  const validateStep1 = () => {
    if (!formData.fullName || !formData.nic || !formData.dob || !formData.gender || !formData.mobile || !formData.email || !formData.address) return 'Please fill out all basic information.';
    if (!validateName(formData.fullName)) return 'Full Name can only contain letters, spaces, and periods.';
    if (!validateNIC(formData.nic)) return 'Please enter a valid NIC (e.g. 123456789V or 123456789012).';
    if (!validatePhone(formData.mobile)) return 'Mobile number must be 10 digits starting with 0.';
    if (!validateEmail(formData.email)) return 'Please enter a valid email address.';
    if (!isEditMode && !formData.password) return 'Password is required.';
    if (!isEditMode && formData.password.length < 6) return 'Password must be at least 6 characters long.';
    return true;
  };

  const validateStep2 = () => {
    if (!formData.role || !formData.hospitalId || !formData.department) return 'Please fill out all employment information.';
    return true;
  };

  const handleNextStep1 = () => {
    const validation = validateStep1();
    if (validation !== true) {
      Alert.alert(t('Validation Error'), t(validation as string));
      return;
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    const validation = validateStep2();
    if (validation !== true) {
      Alert.alert(t('Validation Error'), t(validation as string));
      return;
    }
    setCurrentStep(3);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderDropdownModal = (
    visible: boolean, 
    setVisible: (v: boolean) => void, 
    items: any[], 
    onSelect: (item: any) => void, 
    title: string,
    isHospital = false
  ) => (
    <Modal visible={visible} transparent={true} animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t(title ?? '')}</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.modalItem}
                onPress={() => {
                  if (isHospital) {
                    onSelect(item);
                  } else {
                    onSelect(item);
                  }
                  setVisible(false);
                }}
              >
                <Text style={styles.modalItemText}>{isHospital ? item.name : t(item)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (currentStep > 1) {
              prevStep();
            } else {
              router.back();
            }
          }} 
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? t('Edit Staff Member') : t('Add Staff Member')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper Progress */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, currentStep >= 1 ? styles.stepCircleActive : null]}>
            <Text style={[styles.stepCircleText, currentStep >= 1 ? styles.stepCircleTextActive : null]}>1</Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 1 ? styles.stepLabelActive : null]}>{t("Basic")}</Text>
        </View>
        <View style={[styles.stepLine, currentStep >= 2 ? styles.stepLineActive : null]} />
        
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, currentStep >= 2 ? styles.stepCircleActive : null]}>
            <Text style={[styles.stepCircleText, currentStep >= 2 ? styles.stepCircleTextActive : null]}>2</Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 2 ? styles.stepLabelActive : null]}>{t("Employment")}</Text>
        </View>
        <View style={[styles.stepLine, currentStep >= 3 ? styles.stepLineActive : null]} />

        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, currentStep >= 3 ? styles.stepCircleActive : null]}>
            <Text style={[styles.stepCircleText, currentStep >= 3 ? styles.stepCircleTextActive : null]}>3</Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 3 ? styles.stepLabelActive : null]}>{t("Role Details")}</Text>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>{t("Basic Information")}</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("Full Name*")}</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            value={formData.fullName}
            onChangeText={(text) => setFormData({ ...formData, fullName: text.replace(/[^a-zA-Z\s]/g, '') })}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>{t("NIC*")}</Text>
            <TextInput
              style={styles.input}
              placeholder="98xxxxxxxV"
              value={formData.nic}
              onChangeText={(text) => setFormData({ ...formData, nic: text.replace(/[^0-9vVxX]/g, '') })}
              maxLength={12}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("Date of Birth*")}</Text>
            <TouchableOpacity 
              style={styles.dropdownButton} 
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={formData.dob ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                {formData.dob || 'YYYY-MM-DD'}
              </Text>
              <Ionicons name="calendar" size={16} color={Colors.textMedium} style={styles.dropdownIcon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>{t("Gender*")}</Text>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowGenderDropdown(true)}>
              <Text style={formData.gender ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                {t(formData.gender ?? '') || t('Select Gender')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMedium} style={styles.dropdownIcon} />
            </TouchableOpacity>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("Mobile Number*")}</Text>
            <TextInput
              style={styles.input}
              placeholder="07x xxxxxxx"
              keyboardType="phone-pad"
              value={formData.mobile}
              onChangeText={(text) => setFormData({ ...formData, mobile: text.replace(/[^0-9]/g, '') })}
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("Email Address* (For Login)")}</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text.replace(/\s/g, '') })}
          />
        </View>

        {!isEditMode && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Password*")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Enter secure password")}
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
            />
          </View>
        )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Address*")}</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t("Residential address")}
              multiline
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
            />
          </View>
          
          <TouchableOpacity style={styles.nextButton} onPress={handleNextStep1}>
            <Text style={styles.nextButtonText}>{t("Next: Employment Info →")}</Text>
          </TouchableOpacity>
        </View>
        )}

        {/* STEP 2: Employment Information */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>{t("Employment Information")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("Role*")}</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowRoleDropdown(true)}>
            <Text style={formData.role ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
              {t(formData.role ?? '') || t('Select Role')}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>{t("Employee No")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#f5f5f5', color: Colors.textMedium }]}
              placeholder={t("Auto-generated")}
              value={formData.employeeNo}
              editable={false}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("Date Joined")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#f5f5f5', color: Colors.textMedium }]}
              value={new Date().toISOString().split('T')[0]}
              editable={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("Hospital*")}</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowHospitalDropdown(true)}>
            <Text style={formData.hospitalName ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
              {formData.hospitalName || t('Select Hospital')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMedium} style={styles.dropdownIcon} />
          </TouchableOpacity>
        </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Department*")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("e.g. Cardiology, OPD")}
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
            />
          </View>

          <TouchableOpacity style={styles.nextButton} onPress={handleNextStep2}>
            <Text style={styles.nextButtonText}>{t("Next: Role Details →")}</Text>
          </TouchableOpacity>
        </View>
        )}

        {/* STEP 3: Conditional Fields & Registration */}
        {currentStep === 3 && (
          <View style={styles.stepContent}>
            {formData.role === 'Doctor' ? (
              <View style={styles.conditionalSection}>
                <Text style={styles.sectionTitle}>{t("Doctor Details")}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("Medical Registration Number*")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("Reg No")}
                value={formData.medRegNo}
                onChangeText={(text) => setFormData({ ...formData, medRegNo: text })}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("Specialization*")}</Text>
              <TouchableOpacity
                style={[styles.dropdownSelector, {
                  borderColor: formData.specialization ? Colors.primary : Colors.border,
                  backgroundColor: formData.specialization ? '#F5F9FF' : Colors.white
                }]}
                onPress={() => setShowSpecializationDropdown(true)}
              >
                <Text style={{ 
                  color: formData.specialization ? Colors.textDark : Colors.textLight,
                  flex: 1 
                }}>
                  {formData.specialization ? t(formData.specialization) : t('Select Specialization')}
                </Text>
                <Ionicons name="chevron-down" size={20} color={formData.specialization ? Colors.primary : Colors.textLight} />
              </TouchableOpacity>
            </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("Qualification*")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("e.g. MBBS, MD")}
                    value={formData.doctorQualification}
                    onChangeText={(text) => setFormData({ ...formData, doctorQualification: text })}
                  />
                </View>
              </View>
            ) : formData.role === 'Nurse' ? (
              <View style={styles.conditionalSection}>
                <Text style={styles.sectionTitle}>{t("Nurse Details")}</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("Nursing Registration No*")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("Reg No")}
                    value={formData.nurseRegNo}
                    onChangeText={(text) => setFormData({ ...formData, nurseRegNo: text })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("Qualification*")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("e.g. BSc Nursing")}
                    value={formData.nurseQualification}
                    onChangeText={(text) => setFormData({ ...formData, nurseQualification: text })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("Ward*")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("e.g. Ward 4")}
                    value={formData.ward}
                    onChangeText={(text) => setFormData({ ...formData, ward: text })}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.conditionalSection}>
                <Text style={styles.sectionTitle}>{t("No Additional Details")}</Text>
                <Text style={{ color: Colors.textMedium, fontSize: 14 }}>
                  {t("No extra role-specific details are required for a")}{' '}{t(formData.role ?? '') || t('Staff Member')}.
                </Text>
              </View>
            )}
            
            <View style={{ height: 30 }} />
            <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={loading}>
              <Text style={styles.submitButtonText}>
                {loading 
                  ? (isEditMode ? t('Updating...') : t('Registering...'))
                  : (isEditMode ? t('Update Staff Member') : t('Complete Registration'))}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
        
      </ScrollView>

      {/* Modals */}
      {renderDropdownModal(showRoleDropdown, setShowRoleDropdown, roles, handleRoleSelect, 'Select Role')}
      {renderDropdownModal(showGenderDropdown, setShowGenderDropdown, genders, (item) => setFormData({ ...formData, gender: item }), 'Select Gender')}
      {renderDropdownModal(showSpecializationDropdown, setShowSpecializationDropdown, specializations, (item) => setFormData({ ...formData, specialization: item }), 'Select Specialization')}
      {renderDropdownModal(
        showHospitalDropdown, 
        setShowHospitalDropdown, 
        hospitals, 
        (hosp: any) => setFormData({ ...formData, hospitalId: hosp._id, hospitalName: hosp.name }), 
        'Select Hospital', 
        true
      )}

      {/* Date Picker */}
      {Platform.OS === 'ios' || Platform.OS === 'web' ? (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: Colors.white, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: Colors.primary, fontSize: 16 }}>{t("Cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  const formattedDate = date.toISOString().split('T')[0];
                  setFormData({ ...formData, dob: formattedDate });
                }}>
                  <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 16 }}>{t("Done")}</Text>
                </TouchableOpacity>
              </View>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={formData.dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (value) {
                      setFormData({ ...formData, dob: value });
                      setDate(new Date(`${value}T12:00:00`));
                    }
                  }}
                  style={{ width: '100%', minHeight: 52, fontSize: 16, padding: 12, border: '1px solid #D7DDE5', borderRadius: 8 }}
                  aria-label="Choose date of birth"
                />
              ) : (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={onDateChange}
          />
        )
      )}
      
    </SafeAreaView>
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
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.textDark,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  stepIndicator: {
    alignItems: 'center',
    width: 70,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
  },
  stepCircleText: {
    color: Colors.textMedium,
    fontWeight: '700',
    fontSize: 14,
  },
  stepCircleTextActive: {
    color: Colors.white,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.textMedium,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: Colors.primaryDark,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#EAEAEA',
    marginHorizontal: -5,
    marginBottom: 15, // Offset to align with circles
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  stepContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 15,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: Colors.textMedium,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textDark,
  },
  dropdownButton: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 15,
    color: Colors.textDark,
  },
  dropdownButtonPlaceholder: {
    fontSize: 15,
    color: '#A0A0A0',
  },
  dropdownIcon: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  conditionalSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  nextButton: {
    backgroundColor: '#E6F4F1',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  nextButtonText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 15,
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: Colors.textDark,
  },
});
