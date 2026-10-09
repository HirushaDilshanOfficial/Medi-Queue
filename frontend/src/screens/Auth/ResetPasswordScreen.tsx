import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BASE_URL } from '../../config';
import { ActivityIndicator } from 'react-native';
import { AppIcon } from '../../components/AppIcon';

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const { email, otp } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      Alert.alert(t('Error'), t('Please fill all fields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('Error'), t('Passwords do not match!'));
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword: password }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(t('Success'), t('Your password has been reset successfully.'), [
          { text: t('Login'), onPress: () => router.replace('/(auth)/login') }
        ]);
      } else {
        Alert.alert(t('Error'), data.message || t('Failed to reset password'));
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t('Error'), t('Network error. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <SafeAreaView style={{ flex: 0, backgroundColor: Colors.primaryDark }} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* ---- TEAL HEADER ---- */}
        <View style={styles.header}>
          <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}><LanguageSwitcher tone="dark" /></View>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("← Back")}</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.logoSmall}>
            <AppIcon name="lock" size={24} color={Colors.primaryDark} />
          </View>

          <Text style={styles.headerTitle}>{t("Create new password")}</Text>
          <Text style={styles.headerSubtitle}>{t("Please enter your new password below.")}</Text>
        </View>

        {/* ---- FORM CARD ---- */}
        <View style={styles.formCard}>
          <Text style={styles.description}>
            {t("Create a new password for your account. Please make sure it is strong and secure.")}</Text>

          {/* New Password Field */}
          <Text style={styles.fieldLabel}>{t("New Password")}</Text>
          <View style={styles.inputWrapper}>
            <AppIcon name="lock" size={18} color={Colors.textMedium} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder={t("Enter new password")}
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
              <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Field */}
          <Text style={styles.fieldLabel}>{t("Confirm New Password")}</Text>
          <View style={styles.inputWrapper}>
            <AppIcon name="lock" size={18} color={Colors.textMedium} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder={t("Re-enter new password")}
              placeholderTextColor={Colors.textLight}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          {/* Reset Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleReset} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{t("Reset Password")}</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  // ---- Header ----
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 55,
    paddingBottom: 50,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.primaryLight, opacity: 0.3,
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -50, left: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.primaryLight, opacity: 0.2,
  },
  backButton: {
    marginBottom: 24,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
  },
  logoSmall: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  logoSmallIcon: { fontSize: 28 },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },

  // ---- Form Card ----
  formCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  description: {
    fontSize: 14,
    color: Colors.textMedium,
    marginBottom: 24,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  eyeIcon: { fontSize: 16 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textDark },
  primaryButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 5,
    shadowColor: Colors.primaryDark,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    marginTop: 10,
  },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
