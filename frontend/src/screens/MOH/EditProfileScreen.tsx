import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { BASE_URL } from '../../config';

import { getAuthToken } from '../../services/http';
import { Ionicons } from '@expo/vector-icons';

export default function EditProfileScreen() {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsFetching(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${BASE_URL}/api/users/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFullName(data.fullName || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      }
    } catch (error) {
      console.error('Failed to fetch profile', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!fullName || !email) {
      Alert.alert(t('Error'), t('Name and Email are required.'));
      return;
    }

    setIsLoading(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fullName, email, phone })
      });

      if (response.ok) {
        const updatedData = await response.json();
        // Update local storage just in case
        await AsyncStorage.setItem('user', JSON.stringify(updatedData));
        Alert.alert(t('Success'), t('Profile updated successfully!'), [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert(t('Error'), errorData.message || t('Failed to update profile.'));
      }
    } catch (error: any) {
      Alert.alert(t('Error'), t('An error occurred while updating profile.'));
    } finally {
      setIsLoading(false);
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("Edit Profile")}</Text>
          <View style={{ width: 36 }} />
        </View>

        {isFetching ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.formCard}>
            
            {/* Full Name */}
            <Text style={styles.fieldLabel}>{t("Full Name")}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={20} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t("Enter full name")}
                placeholderTextColor={Colors.textLight}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Email */}
            <Text style={styles.fieldLabel}>{t("Email Address")}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail" size={20} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t("Enter email address")}
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone */}
            <Text style={styles.fieldLabel}>{t("Contact Number")}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call" size={20} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t("Enter contact number")}
                placeholderTextColor={Colors.textLight}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>{t("Save Changes")}</Text>
              )}
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  formCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 24,
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
    marginTop: 8,
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
  saveButton: {
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
  saveButtonDisabled: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
