import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { AppIcon } from '../../components/AppIcon';
import { registerPatient } from '../../services/authService';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from '../../components/GlobalToast';
import { calendarDateLabel, todayKey } from '../../utils/opdDates';

// Register Screen - Expo Router version
export default function RegisterScreen() {
  const { t, locale } = useLanguage();
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

  const selectBirthday = (value: Date) => {
    // A birthday is a calendar date; converting local midnight to UTC changes its day.
    setBirthday(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`);
  };

  const openDatePicker = () => {
    setDate(birthday ? new Date(`${birthday}T12:00:00`) : new Date());
    setShowDatePicker(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate && event.type !== 'dismissed') {
      setDate(selectedDate);
      if (Platform.OS === 'android') {
        selectBirthday(selectedDate);
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
    return /^[a-zA-Z\s]+$/.test(name);
  };

  const handleRegister = async () => {
    if (!fullName || !nic || !birthday || !phone || !email || !password || !confirmPassword) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Please fill in all fields'), position: 'top', topOffset: 60 });
      return;
    }

    if (!validateName(fullName)) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Full Name can only contain letters and spaces.'), position: 'top', topOffset: 60 });
      return;
    }

    if (birthday > todayKey()) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Your birthday cannot be in the future'), position: 'top', topOffset: 60 });
      return;
    }

    if (!validateNIC(nic)) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Please enter a valid NIC (e.g. 123456789V or 123456789012).'), position: 'top', topOffset: 60 });
      return;
    }

    if (!validatePhone(phone)) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Mobile number must be 10 digits starting with 0.'), position: 'top', topOffset: 60 });
      return;
    }

    if (!validateEmail(email)) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Please enter a valid email address.'), position: 'top', topOffset: 60 });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Passwords do not match'), position: 'top', topOffset: 60 });
      return;
    }
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: t('Error'), text2: t('Password must be at least 6 characters'), position: 'top', topOffset: 60 });
      return;
    }

    setIsLoading(true);

    try {
      const patientData = { fullName, nic, birthday, gender, phone, email, password, bloodGroup };
      await registerPatient(patientData);
      
      Toast.show({ type: 'success', text1: t('Success'), text2: t('Account created! Please login.'), position: 'top', topOffset: 60 });
      setTimeout(() => router.replace('/(auth)/login'), 1500);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: t('Registration Failed'), text2: error.message, position: 'top', topOffset: 60 });
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ---- TEAL HEADER ---- */}
        <View style={styles.header}>
<View style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}><LanguageSwitcher tone="dark" /></View>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppIcon name="back" size={18} color={Colors.white} /><Text style={styles.backButtonText}>{t("Back")}</Text></View>
          </TouchableOpacity>
          <View style={{ width: 40, height: 40, backgroundColor: Colors.white, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Image 
              source={require('../../../assets/images/logo.png')} 
              style={{ width: 30, height: 30 }} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.headerTitle}>{t("Create Account")}</Text>
          <Text style={styles.headerSubtitle}>{t("Register as a new patient")}</Text>
        </View>

        {/* ---- FORM ---- */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionLabel}>{t("Full Name")}</Text>
          <TextInput style={styles.input} placeholder={t("Enter your full name")}
            placeholderTextColor={Colors.textLight} value={fullName} onChangeText={(text) => setFullName(text.replace(/[^a-zA-Z\s]/g, ''))} />

          <Text style={styles.sectionLabel}>{t("NIC Number")}</Text>
          <TextInput style={styles.input} placeholder="e.g. 199912345678"
            placeholderTextColor={Colors.textLight} value={nic} onChangeText={(text) => setNic(text.replace(/[^0-9vVxX]/g, ''))} maxLength={12} />

          <Text style={styles.sectionLabel}>{t("Birthday")}</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.dropdownButton}>
              <input
                type="date"
                value={birthday}
                max={todayKey()}
                lang={locale}
                onChange={(event) => setBirthday(event.currentTarget.value)}
                style={webDateInputStyle}
                aria-label={t('Choose birthday')}
              />
            </View>
          ) : (
            <TouchableOpacity style={styles.dropdownButton} onPress={openDatePicker} accessibilityRole="button" accessibilityLabel={t('Choose birthday')}>
              <Text style={birthday ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                {calendarDateLabel(birthday, locale) || 'YYYY-MM-DD'}
              </Text>
              <Text style={styles.dropdownIcon}>📅</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>{t("Gender")}</Text>
          <View style={styles.genderContainer}>
            <TouchableOpacity 
              style={[styles.genderButton, gender === 'Male' && styles.genderActive]} 
              onPress={() => setGender('Male')}
            >
              <Text style={[styles.genderText, gender === 'Male' && styles.genderTextActive]}>{t("Male")}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.genderButton, gender === 'Female' && styles.genderActive]} 
              onPress={() => setGender('Female')}
            >
              <Text style={[styles.genderText, gender === 'Female' && styles.genderTextActive]}>{t("Female")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>{t("Telephone Number")}</Text>
          <TextInput style={styles.input} placeholder="e.g. 0712345678" keyboardType="phone-pad"
            placeholderTextColor={Colors.textLight} value={phone} onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))} maxLength={10} />

          <Text style={styles.sectionLabel}>{t("Blood Group (Optional)")}</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBloodGroupDropdown(true)}>
            <Text style={bloodGroup ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
              {bloodGroup || t('Select Blood Group')}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>{t("Email Address")}</Text>
          <TextInput style={styles.input} placeholder={t("Enter your email")}
            placeholderTextColor={Colors.textLight} value={email} onChangeText={(text) => setEmail(text.replace(/\s/g, ''))}
            keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.sectionLabel}>{t("Password")}</Text>
          <TextInput style={styles.input} placeholder={t("Min. 6 characters")}
            placeholderTextColor={Colors.textLight} value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.sectionLabel}>{t("Confirm Password")}</Text>
          <TextInput style={styles.input} placeholder={t("Re-enter your password")}
            placeholderTextColor={Colors.textLight} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <View style={[styles.infoBox, { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }]} >
            <AppIcon name="medical" size={18} color={Colors.primaryDark} />
            <Text style={[styles.infoText, { flex: 1 }]}>
              {t("Your account will be linked to your NIC for identity verification at the hospital.")}</Text>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={Colors.white} /> :
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.registerButtonText}>{t("Create Account")}</Text><AppIcon name="forward" size={20} color={Colors.white} /></View>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLinkText}>
              {t("Already have an account?")}{' '}<Text style={styles.loginLinkBold}>{t("Login")}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      {renderDropdownModal(showBloodGroupDropdown, setShowBloodGroupDropdown, bloodGroups, setBloodGroup, 'Select Blood Group')}

      {/* Date Picker */}
      {Platform.OS === 'ios' ? (
        <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: Colors.white, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: Colors.primary, fontSize: 16 }}>{t("Cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  selectBirthday(date);
                }}>
                  <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 16 }}>{t("Done")}</Text>
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
        Platform.OS === 'android' && showDatePicker && (
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

// Same inline browser control as the patient's medical-report date field.
const webDateInputStyle: React.CSSProperties = {
  width: '100%', minHeight: 32, border: 0, padding: 0, boxSizing: 'border-box',
  fontSize: 16, color: Colors.textDark, backgroundColor: 'transparent', outlineStyle: 'none',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary, paddingTop: 60, paddingBottom: 60,
    paddingHorizontal: 24, overflow: 'hidden', position: 'relative',
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40, width: 180, height: 180,
    borderRadius: 90, backgroundColor: Colors.primaryLight, opacity: 0.3,
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -20, left: -50, width: 160, height: 160,
    borderRadius: 80, backgroundColor: Colors.primaryLight, opacity: 0.2,
  },
  backButton: { marginBottom: 20 },
  backButtonText: { color: Colors.white, fontSize: 15, fontWeight: '600', opacity: 0.9 },
  headerTitle: { flexShrink: 1, fontSize: 28, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  formContainer: { 
    paddingHorizontal: 20, paddingTop: 30, paddingBottom: 50, 
    backgroundColor: Colors.white, marginHorizontal: 20, marginTop: -40, 
    borderRadius: 24, elevation: 8, shadowColor: Colors.shadow, 
    shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, 
    marginBottom: 40 
  },
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
