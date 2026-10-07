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
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function EditPatientScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState('');
  
  // Date Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(new Date());
  
  // Dropdowns state
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false);
  
  const genders = ['Male', 'Female', 'Other'];
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const [formData, setFormData] = useState({
    fullName: '',
    nic: '',
    birthday: '',
    gender: '',
    bloodGroup: '',
    mobile: '',
    email: '',
  });

  useEffect(() => {
    if (params.editPatientData) {
      try {
        const patient = JSON.parse(params.editPatientData as string);
        setEditId(patient._id);
        if (patient.birthday) {
          setDate(new Date(patient.birthday));
        }
        setFormData({
          fullName: patient.fullName || '',
          nic: patient.nic || '',
          birthday: patient.birthday || '',
          gender: patient.gender || '',
          bloodGroup: patient.bloodGroup || '',
          mobile: patient.mobile || patient.phone || '',
          email: patient.email || '',
        });
      } catch (error) {
        console.error('Failed to parse edit data', error);
      }
    }
  }, [params.editPatientData]);

  const handleSave = async () => {
    if (!formData.fullName || !formData.mobile || !formData.email) {
      alert('Please fill all required fields (*)');
      return;
    }

    setLoading(true);
    try {
      const url = `${API_URL}/patients/${editId}`;
        
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Patient updated successfully!');
        router.back();
      } else {
        alert(data.message || 'Failed to update patient');
      }
    } catch (error) {
      console.error('Error saving patient:', error);
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
        setFormData({ ...formData, birthday: formattedDate });
      }
    }
  };

  const renderDropdownModal = (
    visible: boolean, 
    setVisible: (v: boolean) => void, 
    items: any[], 
    onSelect: (item: any) => void, 
    title: string,
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
                  onSelect(item);
                  setVisible(false);
                }}
              >
                <Text style={styles.modalItemText}>{t(item)}</Text>
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
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("Edit Patient")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.stepContent}>
          <Text style={styles.sectionTitle}>{t("Basic Information")}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Full Name*")}</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>{t("NIC")}</Text>
              <TextInput
                style={styles.input}
                placeholder="98xxxxxxxV"
                value={formData.nic}
                onChangeText={(text) => setFormData({ ...formData, nic: text })}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>{t("Date of Birth")}</Text>
              <TouchableOpacity 
                style={styles.dropdownButton} 
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={formData.birthday ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                  {formData.birthday || 'YYYY-MM-DD'}
                </Text>
                <Text style={styles.dropdownIcon}>📅</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>{t("Gender")}</Text>
              <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowGenderDropdown(true)}>
                <Text style={formData.gender ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                  {t(formData.gender ?? '') || t('Select Gender')}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>{t("Mobile Number*")}</Text>
              <TextInput
                style={styles.input}
                placeholder="07x xxxxxxx"
                keyboardType="phone-pad"
                value={formData.mobile}
                onChangeText={(text) => setFormData({ ...formData, mobile: text })}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Email Address*")}</Text>
            <TextInput
              style={styles.input}
              placeholder="example@mail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Blood Group")}</Text>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBloodGroupDropdown(true)}>
              <Text style={formData.bloodGroup ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                {formData.bloodGroup || t('Select Blood Group')}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
          <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.submitButtonText}>
              {loading ? t('Updating...') : t('Update Patient')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      {renderDropdownModal(showGenderDropdown, setShowGenderDropdown, genders, (item) => setFormData({ ...formData, gender: item }), 'Select Gender')}
      {renderDropdownModal(showBloodGroupDropdown, setShowBloodGroupDropdown, bloodGroups, (item) => setFormData({ ...formData, bloodGroup: item }), 'Select Blood Group')}

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
                  setFormData({ ...formData, birthday: formattedDate });
                }}>
                  <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 16 }}>{t("Done")}</Text>
                </TouchableOpacity>
              </View>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={formData.birthday}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (value) {
                      setFormData({ ...formData, birthday: value });
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
