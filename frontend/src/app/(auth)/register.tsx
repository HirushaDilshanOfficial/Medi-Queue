import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { AppIcon } from '../../components/AppIcon';
import { registerPatient } from '../../services/authService';
import DateTimePicker from '@react-native-community/datetimepicker';

// Register Screen - Expo Router version
export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [nic, setNic] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(new Date());

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      if (Platform.OS === 'android') {
        const formattedDate = selectedDate.toISOString().split('T')[0];
        setBirthday(formattedDate);
      }
    }
  };

  const handleRegister = async () => {
    if (!fullName || !nic || !birthday || !phone || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const patientData = { fullName, nic, birthday, gender, phone, email, password, bloodGroup };
      await registerPatient(patientData);
      
      Alert.alert('Success', 'Account created! Please login.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDropdownModal = (
    visible: boolean, 
    setVisible: (v: boolean) => void, 
    items: string[], 
    onSelect: (item: string) => void, 
    title: string,
  ) => (
    <Modal visible={visible} transparent={true} animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
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
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ---- TEAL HEADER ---- */}
        <View style={styles.header}>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppIcon name="back" size={18} color={Colors.white} /><Text style={styles.backButtonText}>Back</Text></View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Register as a new patient</Text>
        </View>

        {/* ---- FORM ---- */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionLabel}>Full Name</Text>
          <TextInput style={styles.input} placeholder="Enter your full name"
            placeholderTextColor={Colors.textLight} value={fullName} onChangeText={setFullName} />

          <Text style={styles.sectionLabel}>NIC Number</Text>
          <TextInput style={styles.input} placeholder="e.g. 199912345678"
            placeholderTextColor={Colors.textLight} value={nic} onChangeText={setNic} />

          <Text style={styles.sectionLabel}>Birthday</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowDatePicker(true)}>
            <Text style={birthday ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
              {birthday || 'YYYY-MM-DD'}
            </Text>
            <Text style={styles.dropdownIcon}>📅</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Gender</Text>
          <View style={styles.genderContainer}>
            <TouchableOpacity 
              style={[styles.genderButton, gender === 'Male' && styles.genderActive]} 
              onPress={() => setGender('Male')}
            >
              <Text style={[styles.genderText, gender === 'Male' && styles.genderTextActive]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.genderButton, gender === 'Female' && styles.genderActive]} 
              onPress={() => setGender('Female')}
            >
              <Text style={[styles.genderText, gender === 'Female' && styles.genderTextActive]}>Female</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Telephone Number</Text>
          <TextInput style={styles.input} placeholder="e.g. 0712345678" keyboardType="phone-pad"
            placeholderTextColor={Colors.textLight} value={phone} onChangeText={setPhone} />

          <Text style={styles.sectionLabel}>Blood Group (Optional)</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBloodGroupDropdown(true)}>
            <Text style={bloodGroup ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
              {bloodGroup || 'Select Blood Group'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Email Address</Text>
          <TextInput style={styles.input} placeholder="Enter your email"
            placeholderTextColor={Colors.textLight} value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.sectionLabel}>Password</Text>
          <TextInput style={styles.input} placeholder="Min. 6 characters"
            placeholderTextColor={Colors.textLight} value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.sectionLabel}>Confirm Password</Text>
          <TextInput style={styles.input} placeholder="Re-enter your password"
            placeholderTextColor={Colors.textLight} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <View style={[styles.infoBox, { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }]} >
            <AppIcon name="medical" size={18} color={Colors.primaryDark} />
            <Text style={[styles.infoText, { flex: 1 }]}>
              Your account will be linked to your NIC for identity verification at the hospital.
            </Text>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={Colors.white} /> :
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.registerButtonText}>Create Account</Text><AppIcon name="forward" size={20} color={Colors.white} /></View>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      {renderDropdownModal(showBloodGroupDropdown, setShowBloodGroupDropdown, bloodGroups, setBloodGroup, 'Select Blood Group')}

      {/* Date Picker */}
      {Platform.OS === 'ios' ? (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: Colors.white, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: Colors.primary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  const formattedDate = date.toISOString().split('T')[0];
                  setBirthday(formattedDate);
                }}>
                  <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
              />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 40,
    paddingHorizontal: 24, overflow: 'hidden', position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40, width: 160, height: 160,
    borderRadius: 80, backgroundColor: Colors.primaryLight, opacity: 0.3,
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -30, left: -50, width: 140, height: 140,
    borderRadius: 70, backgroundColor: Colors.primaryLight, opacity: 0.2,
  },
  backButton: { marginBottom: 20 },
  backButtonText: { color: Colors.white, fontSize: 15, fontWeight: '600', opacity: 0.9 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  formContainer: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 50 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textMedium,
    marginBottom: 8, marginTop: 4, letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.textDark, marginBottom: 14,
  },
  genderContainer: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  genderButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
  genderActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  genderText: { color: Colors.textDark, fontSize: 15, fontWeight: '600' },
  genderTextActive: { color: Colors.white },
  infoBox: {
    backgroundColor: Colors.primaryFaded, borderRadius: 12, padding: 14,
    marginBottom: 20, marginTop: 6, borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  infoText: { fontSize: 12, color: Colors.textMedium, lineHeight: 18 },
  registerButton: {
    backgroundColor: Colors.primaryDark, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', elevation: 5,
  },
  registerButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  loginLink: { alignItems: 'center', marginTop: 20, paddingVertical: 12 },
  loginLinkText: { fontSize: 14, color: Colors.textMedium },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
  
  // Modal styles
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
    marginBottom: 14,
  },
  dropdownButtonText: {
    fontSize: 15,
    color: Colors.textDark,
  },
  dropdownButtonPlaceholder: {
    fontSize: 15,
    color: Colors.textLight,
  },
  dropdownIcon: {
    fontSize: 12,
    color: Colors.textMedium,
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
