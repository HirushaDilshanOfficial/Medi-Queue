import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { MOHBottomNav } from '../../components/moh/MOHBottomNav';
import { getAuthToken } from '../../services/http';
import { BASE_URL } from '../../config';

export default function SendNotificationScreen() {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('All');
  const [isEmergency, setIsEmergency] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const roles = ['All', 'Patient', 'Doctor', 'Receptionist', 'MOH'];

  const handleSend = async () => {
    if (!title || !message) {
      Alert.alert(t('Error'), t('Please enter a title and message.'));
      return;
    }

    setIsLoading(true);

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`${BASE_URL}/api/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          message,
          targetRole,
          isEmergency
        })
      });

      if (response.ok) {
        Alert.alert(t('Success'), t('Notification sent successfully!'), [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const data = await response.json();
        Alert.alert(t('Error'), data.message || t('Failed to send notification.'));
      }
    } catch (error) {
      Alert.alert(t('Error'), t('Something went wrong while sending.'));
      console.error(error);
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
      
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("Broadcast Notification")}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t("Create New Alert")}</Text>
          <Text style={styles.sectionDesc}>{t("This message will be instantly delivered in-app to the selected user groups.")}</Text>

          {/* Title */}
          <Text style={styles.fieldLabel}>{t("Notification Title")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("E.g., Dengue Awareness Campaign")}
            placeholderTextColor={Colors.textLight}
            value={title}
            onChangeText={setTitle}
          />

          {/* Target Role Selector */}
          <Text style={styles.fieldLabel}>{t("Send To")}</Text>
          <View style={styles.roleContainer}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleBadge,
                  targetRole === role && styles.roleBadgeActive
                ]}
                onPress={() => setTargetRole(role)}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    targetRole === role && styles.roleBadgeTextActive
                  ]}
                >
                  {t(role)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message */}
          <Text style={styles.fieldLabel}>{t("Message Body")}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t("Type your message here...")}
            placeholderTextColor={Colors.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Emergency Switch */}
          <View style={styles.emergencyContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>{t("Set as Emergency Banner")}</Text>
              <Text style={styles.emergencyDesc}>{t("Displays a persistent red banner at the top of the user's dashboard.")}</Text>
            </View>
            <Switch
              trackColor={{ false: Colors.border, true: Colors.error }}
              thumbColor={Colors.white}
              onValueChange={setIsEmergency}
              value={isEmergency}
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>{t("Send Notification")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <MOHBottomNav activeRoute="home" />
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
    marginBottom: 40,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textMedium,
    marginBottom: 24,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textDark,
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBadgeActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  roleBadgeTextActive: {
    color: Colors.primaryDark,
  },
  sendButton: {
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
  sendButtonDisabled: {
    opacity: 0.8,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emergencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD6D6',
    marginBottom: 20,
    marginTop: 10,
  },
  emergencyTitle: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 15,
  },
  emergencyDesc: {
    color: Colors.error + '99',
    fontSize: 12,
    marginTop: 4,
  },
});
