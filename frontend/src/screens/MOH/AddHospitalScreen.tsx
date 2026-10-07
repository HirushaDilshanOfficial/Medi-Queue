import React, { useState } from 'react';
import {
  View,
  Text,
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function AddHospitalScreen() {
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

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: '',
    contact: '',
    location: '',
    departments: '', // Comma separated for now
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
          location: hospital.location || '',
          departments: hospital.departments ? hospital.departments.join(', ') : '',
        });
      } catch (error) {
        console.error('Failed to parse edit data', error);
      }
    }
  }, [params.editHospitalData]);

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.type || !formData.contact || !formData.location) {
      alert('Please fill all required fields');
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
        alert(isEditMode ? 'Hospital updated successfully!' : 'Hospital registered successfully!');
        router.back();
      } else {
        alert(data.message || (isEditMode ? 'Failed to update hospital' : 'Failed to register hospital'));
      }
    } catch (error) {
      console.error('Error adding hospital:', error);
      alert('Network error. Please try again later.');
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
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Hospital' : 'Add New Hospital'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>Hospital Details</Text>
              <Text style={styles.sectionSubtitle}>Enter the official information of the facility.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Hospital Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Colombo National Hospital"
                  placeholderTextColor={Colors.textLight}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Hospital Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. CNH-001"
                    placeholderTextColor={Colors.textLight}
                    value={formData.code}
                    onChangeText={(text) => setFormData({ ...formData, code: text })}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Hospital Type</Text>
                  <TouchableOpacity 
                    style={styles.dropdownButton}
                    onPress={() => setShowTypeDropdown(true)}
                  >
                    <Text style={{ color: formData.type ? Colors.textDark : Colors.textLight }}>
                      {formData.type || 'Select Type'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textMedium} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Location & Contact</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address / Location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter full address"
                  placeholderTextColor={Colors.textLight}
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Information</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Phone or Email"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                  value={formData.contact}
                  onChangeText={(text) => setFormData({ ...formData, contact: text })}
                />
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Medical Departments</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Departments (Comma separated)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="e.g. OPD, Cardiology, Neurology"
                  placeholderTextColor={Colors.textLight}
                  multiline
                  value={formData.departments}
                  onChangeText={(text) => setFormData({ ...formData, departments: text })}
                />
              </View>

            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.submitButtonText}>
              {loading 
                ? (isEditMode ? 'Updating...' : 'Registering...') 
                : (isEditMode ? 'Update Hospital' : 'Register Hospital')}
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
              <Text style={styles.modalTitle}>Select Hospital Type</Text>
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
                  ]}>{type}</Text>
                  {formData.type === type && <Ionicons name="checkmark" size={16} color={Colors.white} style={styles.modalOptionCheck} />}
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
});
