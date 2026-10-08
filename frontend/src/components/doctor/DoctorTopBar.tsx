import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { DOCTOR_TOKENS as C } from './doctorTheme';
import { useLanguage, LANGUAGES } from '../../i18n/LanguageContext';
import { useTheme } from '../../theme/ThemeContext';

interface DoctorTopBarProps {
  doctorName?: string;
  room?: string;
  roomSubtitle?: string;
  unreadCount?: number;
}

export const DoctorTopBar = ({
  doctorName = 'Dr. Palitha Perera',
  room = 'Room 101',
  roomSubtitle,
  unreadCount = 4,
}: DoctorTopBarProps) => {
  const { t, language, setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@doctor_profile_photo');
        if (stored) setProfilePhoto(stored);
      } catch (e) {}
    })();
  }, []);

  const doctorInitials = React.useMemo(() => {
    const clean = doctorName.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase() || 'PP';
  }, [doctorName]);

  const handleChangePhoto = async () => {
    setIsProfileMenuOpen(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setProfilePhoto(uri);
        await AsyncStorage.setItem('@doctor_profile_photo', uri);
      }
    } catch (e) {
      Alert.alert(t('Error'), t('Could not select profile photo.'));
    }
  };

  const handleRemovePhoto = async () => {
    setIsProfileMenuOpen(false);
    try {
      await AsyncStorage.removeItem('@doctor_profile_photo');
      setProfilePhoto(null);
    } catch (e) {}
  };

  const handleConfirmSignOut = async () => {
    setIsSignOutModalOpen(false);
    try {
      await AsyncStorage.multiRemove([
        'token',
        'user',
        '@medi_queue_auth_token',
        '@medi_queue_doctor_break',
      ]);
    } catch (e) {}
    router.replace('/(auth)/login' as any);
  };

  return (
    <View style={styles.headerContainer}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.contentRow}>
          {/* Left: Profile button (Avatar with online dot + Doctor Name + Chevron + Room) */}
          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.8}
            onPress={() => setIsProfileMenuOpen(true)}
          >
            <View style={styles.avatarWrap}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitialsText}>{doctorInitials}</Text>
                </View>
              )}
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.doctorInfoCol}>
              <View style={styles.doctorNameRow}>
                <Text style={styles.doctorNameText} numberOfLines={1}>
                  {doctorName}
                </Text>
                <Ionicons name="chevron-down" size={13} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.roomText} numberOfLines={1}>
                {roomSubtitle || `${room} · ${t('Online')}`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right: Language chip "EN" + Bell button with red badge */}
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.langChip}
              activeOpacity={0.75}
              onPress={() => setIsLanguageModalOpen(true)}
              accessibilityLabel={t('Change language')}
            >
              <Ionicons name="globe-outline" size={15} color="#FFFFFF" />
              <Text style={styles.langChipText}>{(language || 'en').toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.themeChip}
              activeOpacity={0.75}
              onPress={toggleTheme}
              accessibilityLabel={isDark ? t('Light mode') : t('Dark mode')}
            >
              <Ionicons name={isDark ? 'sunny' : 'moon-outline'} size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bellBtn}
              activeOpacity={0.75}
              onPress={() => router.push('/notifications')}
              accessibilityLabel={t('Notifications')}
            >
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ========================================================= */}
      {/* PROFILE DROPDOWN MENU MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={isProfileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProfileMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsProfileMenuOpen(false)}
        >
          <View style={styles.menuCard} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHeader}>
              <View style={styles.menuAvatarWrap}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.menuAvatarImg} />
                ) : (
                  <View style={styles.menuAvatarCircle}>
                    <Text style={styles.menuAvatarInitials}>{doctorInitials}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuDoctorName} numberOfLines={1}>
                  {doctorName}
                </Text>
                <Text style={styles.menuRoomText}>
                  {room} · {t('OPD Clinic')}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleChangePhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={18} color={C.tealDeep} style={styles.menuIcon} />
              <Text style={styles.menuItemText}>{t('Change profile photo')}</Text>
            </TouchableOpacity>

            {profilePhoto && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleRemovePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={C.sub} style={styles.menuIcon} />
                <Text style={styles.menuItemText}>{t('Remove photo')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.menuDivider} />

            <View style={styles.menuThemeRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={19}
                  color={C.tealDeep}
                  style={styles.menuIcon}
                />
                <Text style={styles.menuItemText}>{t('Dark mode')}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#cbd5e1', true: C.teal }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                setIsSignOutModalOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color={C.alert} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: C.alert, fontWeight: '800' }]}>
                {t('Sign out')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* SIGN OUT CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      <Modal
        visible={isSignOutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSignOutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="log-out" size={24} color={C.alert} />
            </View>
            <Text style={styles.confirmTitle}>{t('Sign out?')}</Text>
            <Text style={styles.confirmMessage}>
              {t('You will need to sign in again to see your queue and patient records.')}
            </Text>
            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setIsSignOutModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSignOutBtn}
                onPress={handleConfirmSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmSignOutText}>{t('Sign out')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* LANGUAGE SELECTOR MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLanguageModalOpen(false)}
        >
          <View style={styles.langModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.langModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="globe-outline" size={20} color={C.tealDeep} style={{ marginRight: 8 }} />
                <Text style={styles.langModalTitle}>{t('Language')}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLanguageModalOpen(false)}>
                <Ionicons name="close" size={20} color={C.sub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.langModalSub}>{t('Choose your preferred language')}</Text>

            <View style={{ gap: 8, marginTop: 6 }}>
              {LANGUAGES.map((item) => {
                const isSelected = language === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.langOptionRow, isSelected && styles.langOptionRowSelected]}
                    onPress={async () => {
                      await setLanguage(item.code);
                      setIsLanguageModalOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={[styles.langOptionName, isSelected && { color: C.tealDeep, fontWeight: '800' }]}>
                        {item.name}
                      </Text>
                      <Text style={styles.langOptionCode}>{item.code.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: C.teal,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  safeArea: {
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarInitialsText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.tealDeep,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: C.ok,
    borderWidth: 2,
    borderColor: C.teal,
  },
  doctorInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  doctorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 19,
  },
  roomText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.white80,
    marginTop: 2,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langChip: {
    backgroundColor: C.white18,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  themeChip: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: C.white18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: C.white18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: C.alert,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 39, 43, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  // Profile menu
  menuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    ...C.cardShadow,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  menuAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  menuAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  menuAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarInitials: {
    fontSize: 17,
    fontWeight: '800',
    color: C.tealDeep,
  },
  menuDoctorName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  menuRoomText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  menuThemeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  // Sign out confirmation dialog
  confirmCard: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    ...C.cardShadow,
  },
  confirmIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 13,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
  confirmSignOutBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSignOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Language modal
  langModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 20,
    ...C.cardShadow,
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },
  langModalSub: {
    fontSize: 13,
    color: C.sub,
    marginBottom: 14,
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  langOptionRowSelected: {
    backgroundColor: C.tint,
    borderColor: C.teal,
  },
  langOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  langOptionCode: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: C.teal,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.teal,
  },
});
