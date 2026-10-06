import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { AppIcon } from '../../components/AppIcon';
import { login } from '../../services/authService';
import { setAuthToken as setHttpAuthToken } from '../../services/http';
import { setAuthToken as setApiAuthToken } from '../../services/api';

// Actual Login Form - Email & Password
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email ත් Password ත් fill කරන්න!');
      return;
    }

    setIsLoading(true);

    try {
      const userData = await login(email, password);
      // Persist JWT token to AsyncStorage for all modules and API services
      await AsyncStorage.setItem('token', userData.token);
      await AsyncStorage.setItem('jwt', userData.token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setHttpAuthToken(userData.token);
      setApiAuthToken(userData.token);

      // Successfully logged in
      Alert.alert('Success', `Welcome back, ${userData.fullName}!`);

      // Navigate based on role
      if (userData.role === 'MOH') {
        router.replace('/(moh)/dashboard' as any);
      } else if (userData.role === 'Patient') {
        router.replace('/(patient)' as any);
      } else if (String(userData.role || '').toLowerCase() === 'receptionist') {
        router.replace('/(reception)/dashboard' as any);
      } else if (String(userData.role || '').toLowerCase() === 'doctor') {
        router.replace('/(doctor)/dashboard' as any);
      } else {
        Alert.alert('Notice', `Logged in as ${userData.role}, but dashboard is not created yet.`);
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ flex: 1 }}>
        {/* ---- TEAL HEADER ---- */}
        <View style={styles.header}>
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppIcon name="back" size={18} color={Colors.white} /><Text style={styles.backButtonText}>Back</Text></View>
          </TouchableOpacity>

          {/* Small Logo */}
          <View style={styles.logoSmall}>
            <AppIcon name="medical" size={28} color={Colors.primaryDark} />
          </View>

          <Text style={styles.headerTitle}>Welcome Back</Text>
          <Text style={styles.headerSubtitle}>Sign in to your account</Text>
        </View>

        {/* ---- LOGIN FORM CARD ---- */}
        <View style={styles.formCard}>

          {/* Email Field */}
          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <AppIcon name="mail" size={20} color={Colors.textMedium} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Field */}
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <AppIcon name="lock" size={20} color={Colors.textMedium} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            {/* Show/Hide password toggle */}
            <TouchableOpacity
              style={styles.eyeButton}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword(!showPassword)}
            >
              <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.white} size="small" />
                <Text style={styles.loginButtonText}>  Signing in...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.loginButtonText}>Sign In</Text><AppIcon name="forward" size={20} color={Colors.white} /></View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerButtonText}>
              New patient? <Text style={styles.registerBold}>Create Account</Text>
            </Text>
          </TouchableOpacity>

        </View>

        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, marginBottom: 40 }}>
          <AppIcon name="flag" size={14} color={Colors.textLight} />
          <Text style={[styles.footer, { marginTop: 0, marginBottom: 0 }]}>Ministry of Health · Sri Lanka</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

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
    marginBottom: 16,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textDark,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: { fontSize: 16 },

  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },

  // ---- Login Button ----
  loginButton: {
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
  loginButtonDisabled: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ---- Divider ----
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textLight,
    marginHorizontal: 12,
    fontWeight: '500',
  },

  // ---- Register Link ----
  registerButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  registerButtonText: {
    fontSize: 14,
    color: Colors.textMedium,
  },
  registerBold: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // ---- Footer ----
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 24,
    marginBottom: 40,
  },
});
