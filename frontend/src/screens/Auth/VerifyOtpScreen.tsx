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
  SafeAreaView
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BASE_URL } from '../../config';
import { Alert, ActivityIndicator } from 'react-native';

export default function VerifyOtpScreen() {
  const { t } = useLanguage();
  const { email } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert(t('Error'), t('Please enter a valid 6-digit OTP'));
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to reset password passing email and otp
        router.push({ pathname: '/(auth)/reset-password', params: { email, otp } });
      } else {
        Alert.alert(t('Error'), data.message || t('Invalid OTP'));
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
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("← Back")}</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.logoSmall}>
            <Text style={styles.logoSmallIcon}>📩</Text>
          </View>

          <Text style={styles.headerTitle}>{t("Check your email")}</Text>
          <Text style={styles.headerSubtitle}>{t("We sent a verification code to you.")}</Text>
        </View>

        {/* ---- FORM CARD ---- */}
        <View style={styles.formCard}>
          <Text style={styles.description}>
            {t("We have sent a 6-digit verification code to")}{' '}{'\n'}
            <Text style={styles.boldText}>{email || t('your email')}</Text>
          </Text>

          {/* OTP Field */}
          <Text style={styles.fieldLabel}>{t("Enter OTP")}</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔢</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor={Colors.textLight}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleVerify} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{t("Verify & Proceed")}</Text>
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
    textAlign: 'center',
  },
  boldText: { fontWeight: '700', color: Colors.primaryDark },
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
    marginBottom: 24,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 18, color: Colors.textDark, letterSpacing: 4 },
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
  },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
