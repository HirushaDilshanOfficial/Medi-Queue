import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { BloodGroup, Gender, ProfileDraft } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader, MessageState } from '../../../components/patient/ScreenStates';
import { FormField, ChipGroup, SwitchRow } from '../../../components/patient/FormField';
import { isoToInputDate } from '../../../utils/opdDates';

// The option values exclude null even though the stored field allows it, because
// `ChipGroup` represents "not set" as a null value rather than as an option.
const GENDERS: { value: NonNullable<Gender>; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const BLOOD_GROUPS: { value: NonNullable<BloodGroup>; label: string }[] = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

export function EditProfileScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const profile = useAsyncResource(() => patientApi.getProfile(), []);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(null);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  // Fields are seeded once from the server, then owned by local state. Editing
  // the form must not fight a background refresh, so later reloads are ignored.
  const [seeded, setSeeded] = useState(false);
  if (profile.data && !seeded) {
    const patient = profile.data.patient;
    setPhone(patient.phone ?? '');
    setEmail(patient.email ?? '');
    setBirthday(isoToInputDate(patient.birthday));
    setGender(patient.gender);
    setBloodGroup(patient.bloodGroup);
    setAddress(patient.address ?? '');
    setDistrict(patient.district ?? '');
    setAllergies(patient.allergies.join(', '));
    setEmergencyName(patient.emergencyContact?.name ?? '');
    setEmergencyRelationship(patient.emergencyContact?.relationship ?? '');
    setEmergencyPhone(patient.emergencyContact?.phone ?? '');
    setRemindersEnabled(patient.remindersEnabled);
    setSeeded(true);
  }

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'That email address does not look right';
    }

    // The date input gives "YYYY-MM-DD" or "". An unparseable value here means
    // the platform produced something unexpected, and a future date is a typo.
    if (birthday.trim()) {
      const parsed = new Date(`${birthday.trim()}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.birthday = 'Use the format YYYY-MM-DD';
      } else if (parsed.getTime() > Date.now()) {
        errors.birthday = 'Your birthday cannot be in the future';
      }
    }

    return errors;
  }, [birthday, email]);

  const onSave = useCallback(async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const draft: ProfileDraft = {
      phone: phone.trim() || null,
      email: email.trim() || null,
      birthday: birthday.trim() || null,
      gender,
      bloodGroup,
      address: address.trim() || null,
      district: district.trim() || null,
      // Sent as a list because that is how the model stores it; the comma
      // separated input is a display convenience only.
      allergies: allergies
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      remindersEnabled,
      emergencyContact:
        emergencyName.trim() || emergencyRelationship.trim() || emergencyPhone.trim()
          ? {
              name: emergencyName.trim() || null,
              relationship: emergencyRelationship.trim() || null,
              phone: emergencyPhone.trim() || null,
            }
          : null,
    };

    setSaving(true);
    try {
      await patientApi.updateProfile(draft);
      Alert.alert(t('Saved'), t('Your details have been updated.'), [
        { text: t('Done'), onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        t('Could not save'),
        error instanceof Error ? error.message : t('Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }, [
    address,
    allergies,
    birthday,
    bloodGroup,
    district,
    email,
    emergencyName,
    emergencyPhone,
    emergencyRelationship,
    gender,
    phone,
    remindersEnabled,
    router,
    validate,
    t,
  ]);

  if (profile.loading && !profile.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title={t("Edit profile")} showBack />
        <ScreenLoader label={t("Loading your details")} />
      </View>
    );
  }

  if (profile.error && !profile.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title={t("Edit profile")} showBack />
        <MessageState
          icon="help"
          title={t("Could not load your details")}
          description={profile.error}
          actionLabel={t("Try again")}
          onAction={profile.reload}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + PatientTheme.spaceSm }}>
        <ScreenHeader
          title={t("Edit profile")}
          subtitle={t("Keep your contact details current")}
          showBack
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {t("Your name and NIC are set when you register. Contact the clinic desk to change them.")}</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("Contact")}</Text>
          <FormField
            label={t("Phone number")}
            value={phone}
            onChangeText={setPhone}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
            optional
            maxLength={30}
          />
          <FormField
            label={t("Email address")}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            error={fieldErrors.email}
            optional
            maxLength={120}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("About you")}</Text>
          <FormField
            label={t("Birthday")}
            value={birthday}
            onChangeText={setBirthday}
            placeholder="YYYY-MM-DD"
            hint={t("Used to check your age at a consultation")}
            error={fieldErrors.birthday}
            optional
            maxLength={10}
          />
          <ChipGroup<NonNullable<Gender>>
            label={t("Gender")}
            value={gender}
            options={GENDERS}
            onChange={setGender}
            optional
          />
          <ChipGroup<NonNullable<BloodGroup>>
            label={t("Blood group")}
            value={bloodGroup}
            options={BLOOD_GROUPS}
            onChange={setBloodGroup}
            optional
          />
          <FormField
            label={t("Address")}
            value={address}
            onChangeText={setAddress}
            placeholder={t("Street, town")}
            multiline
            optional
            maxLength={200}
          />
          <FormField
            label={t("District")}
            value={district}
            onChangeText={setDistrict}
            placeholder="Colombo"
            optional
            maxLength={80}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("Clinical")}</Text>
          <FormField
            label={t("Allergies")}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="Penicillin, Dust"
            hint={t("Separate each with a comma. Shown to your doctor at a visit.")}
            multiline
            optional
            maxLength={500}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("Emergency contact")}</Text>
          <FormField
            label={t("Name")}
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="Kamala Perera"
            optional
            maxLength={120}
          />
          <FormField
            label={t("Relationship")}
            value={emergencyRelationship}
            onChangeText={setEmergencyRelationship}
            placeholder={t("Mother")}
            optional
            maxLength={120}
          />
          <FormField
            label={t("Phone number")}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
            optional
            maxLength={30}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("Reminders")}</Text>
          <View style={styles.switchCard}>
            <SwitchRow
              label={t("Appointment reminders")}
              description={t("A reminder the day before each booking")}
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + PatientTheme.spaceSm }]}>
        <Pressable
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("Save changes")}
          style={({ pressed }) => [
            styles.save,
            pressed && styles.pressed,
            saving && styles.saveDisabled,
          ]}
        >
          <Text style={styles.saveLabel}>{saving ? t('Saving...') : t('Save changes')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PatientTheme.background,
  },
  scroll: {
    paddingBottom: PatientTheme.spaceXxl,
    gap: PatientTheme.spaceLg,
  },
  notice: {
    marginHorizontal: PatientTheme.spaceLg,
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusMd,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  noticeText: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
    lineHeight: 16,
  },
  group: {
    paddingHorizontal: PatientTheme.spaceLg,
    gap: PatientTheme.spaceMd,
  },
  groupTitle: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  switchCard: {
    padding: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusLg,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  footer: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingTop: PatientTheme.spaceMd,
    borderTopWidth: 1,
    borderTopColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  save: {
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusPill,
    alignItems: 'center',
    backgroundColor: PatientTheme.brand,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveLabel: {
    color: PatientTheme.textOnBrand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
