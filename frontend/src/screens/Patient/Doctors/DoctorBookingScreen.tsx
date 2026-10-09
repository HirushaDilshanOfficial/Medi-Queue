import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';
import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Circle, Path } from 'react-native-svg';
import { doctorApi } from '../../../services/doctorApi';
import { bookingApi } from '../../../services/bookingApi';
import { patientApi } from '../../../services/patientApi';
import { HttpError } from '../../../services/http';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { SlotOption } from '../../../types/patient';
import { addDaysKey, isPastDateKey, longDayLabel, shortDayParts, todayKey } from '../../../utils/opdDates';
import { DesignImage } from '../../../components/patient/DesignImage';
import { PassQr } from '../../../components/patient/PassQr';
import type { QueuePass } from '../../../types/patient';

const C = {
  background: '#f3faff', primary: '#004c5b', secondary: '#00696e',
  text: '#0e1e23', muted: '#3f484b', outline: '#6f797c',
  pale: '#e6f6ff', container: '#e0f0f9', white: '#ffffff',
};
type BookingTab = 'Appointment' | 'Schedule' | 'About';
type BookingIconName = 'back' | 'phone' | 'more' | 'upload' | 'plus' | 'check';

function BookingIcon({ name, color = C.primary, size = 22 }: { name: BookingIconName; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {name === 'back' && <Path d="M20 12H4m7-7-7 7 7 7" />}
      {name === 'phone' && <Path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-1-2 2a15 15 0 0 1-7-7l2-2-1-5Z" />}
      {name === 'more' && <><Circle cx={12} cy={5} r={1} fill={color} /><Circle cx={12} cy={12} r={1} fill={color} /><Circle cx={12} cy={19} r={1} fill={color} /></>}
      {name === 'upload' && <><Path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M12 17v-6m-3 3 3-3 3 3" /></>}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
      {name === 'check' && <><Circle cx={12} cy={12} r={9} /><Path d="m8 12 3 3 5-6" /></>}
    </Svg>
  );
}

export function DoctorBookingScreen() {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, rescheduleId, section } = useLocalSearchParams<{ id: string; rescheduleId?: string; section?: string }>();
  const doctorId = Array.isArray(id) ? id[0] : id;
  const rescheduling = Array.isArray(rescheduleId) ? rescheduleId[0] : rescheduleId;
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const tab: BookingTab = requestedSection === 'Schedule' || requestedSection === 'About' ? requestedSection : 'Appointment';
  const setTab = (next: BookingTab) => router.setParams({ section: next });
  const [mode, setMode] = useState<'Hospital' | 'Online'>('Hospital');
  const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [bookingPass, setBookingPass] = useState<QueuePass | null>(null);
  const [bookedTime, setBookedTime] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [documentUploadError, setDocumentUploadError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateStrip = useRef<ScrollView>(null);
  const submissionPending = useRef(false);

  const doctor = useAsyncResource(() => doctorApi.getById(doctorId), [doctorId]);
  const days = useAsyncResource(() => bookingApi.bookableDays(doctorId), [doctorId]);
  const hospitalToday = todayKey();
  const maxDateKey = addDaysKey(hospitalToday, 14);
  const availableDays = (days.data?.days ?? []).filter((day) => !isPastDateKey(day.date, hospitalToday) && day.date <= maxDateKey);
  const date = chosenDate ?? availableDays[0]?.date ?? null;
  const slots = useAsyncResource(
    () => date ? bookingApi.slots(doctorId, date) : Promise.resolve<{ date: string; slots: SlotOption[] }>({ date: '', slots: [] }),
    [doctorId, date],
  );
  // A previous day's cached slots must never remain selectable during a reload.
  const currentSlots = slots.data?.date === date ? slots.data.slots : [];
  const dateIsValid = Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isPastDateKey(date, hospitalToday) && date <= maxDateKey);
  const canSubmit = mode === 'Hospital' && !!date && !!time && !submitting && !bookingConfirmed
    && dateIsValid
    && !days.loading && !days.error && !slots.loading && !slots.error
    && currentSlots.some(slot => slot.time === time && slot.available);

  const selectDate = useCallback((next: string) => {
    setChosenDate(next);
    setTime(null);
    setBookingError(null);
  }, []);

  const submit = async () => {
    if (!canSubmit || !date || !time || submissionPending.current) return;
    setBookingError(null);
    if (!dateIsValid) {
      Alert.alert(t('Invalid appointment date'), t('Please choose a date from today through the next 14 days.'));
      setTime(null);
      return;
    }
    submissionPending.current = true;
    setSubmitting(true);
    try {
      let bookingResult: Awaited<ReturnType<typeof bookingApi.create>> | null = null;
      if (rescheduling) await bookingApi.reschedule(rescheduling, date, time);
      else bookingResult = await bookingApi.create({ doctorId, date, slotTime: time, reason: reason.trim() || undefined });
      if (rescheduling) {
        Alert.alert(t('Appointment updated'), t("{value0} at {value1}", { value0: String(longDayLabel(date, locale)), value1: String(time) }));
        router.back();
      } else {
        // A successful booking is final even if an optional document upload fails.
        // Display the issued pass immediately instead of waiting for the upload.
        setBookingConfirmed(true);
        setBookedTime(bookingResult!.appointment.slotTime);
        setDocumentUploadError(null);
        setBookingPass(bookingResult!.pass);
        let documentUploadFailed = false;
        let documentUploadError = '';
        if (selectedDocument && bookingResult?.appointment.id) {
          setUploadingDocument(true);
          try {
            const form = new FormData();
            form.append('title', selectedDocument.name || 'Medical document');
            form.append('category', 'General');
            form.append('reportDate', date);
            form.append('appointmentId', bookingResult.appointment.id);
            if (selectedDocument.file) {
              form.append('file', selectedDocument.file);
            } else {
              form.append('file', {
                uri: selectedDocument.uri,
                name: selectedDocument.name || 'medical-document',
                type: selectedDocument.mimeType || 'application/octet-stream',
              } as unknown as Blob);
            }
            await patientApi.uploadReport(form);
          } catch (error) {
            documentUploadFailed = true;
            documentUploadError = error instanceof HttpError
              ? error.message
              : t('Please add the document from your reports page.');
          } finally {
            setUploadingDocument(false);
          }
        }
        setDocumentUploadError(documentUploadFailed ? documentUploadError : null);
      }
    } catch (error) {
      const msg = error instanceof HttpError ? error.message : t('Please try again.');
      setBookingError(msg);
      Alert.alert(t('Could not confirm appointment'), msg);
      // Refresh capacity after a conflict so a sold-out slot cannot be retried.
      if (error instanceof HttpError && error.status === 409) {
        setTime(null);
        slots.reload();
        days.reload();
      }
    } finally {
      submissionPending.current = false;
      setSubmitting(false);
    }
  };

  const chooseDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if ((file.size ?? 0) > 10 * 1024 * 1024) {
      Alert.alert(t('Medical document'), t('The report file must be 10 MB or smaller.'));
      return;
    }
    setSelectedDocument(file);
  }, [t]);
  const showOptions = () => Alert.alert(t('Appointment options'), t('Choose an action'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('About this doctor'), onPress: () => setTab('About') },
    { text: t('Refresh availability'), onPress: () => { setTime(null); days.reload(); slots.reload(); } },
  ]);
  const profile = doctor.data?.doctor;
  const viewBookedPass = () => {
    if (submissionPending.current) return;
    setBookingPass(null);
    router.replace('/(patient)/queue');
  };
  const services = profile?.department.toLowerCase().includes('orthop')
    ? ['Consultation', 'Diagnostics', 'Surgery', 'Rehabilitation', 'Physical Therapy']
    : ['Consultation', 'Diagnostics'];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerSafe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Go back")} onPress={() => router.back()} style={styles.backButton}>
            <BookingIcon name="back" color={C.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>{rescheduling ? t('Change Appointment') : t('Book Department Slot')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Open patient profile")} onPress={() => router.push('/(patient)/profile')} style={styles.profileButton}>
            <DesignImage name="profile" size={18} color={C.white} />
          </Pressable>
          <LanguageSwitcher tone="light" />
        </View>
      </View>

      {doctor.loading ? (
        <View style={styles.state}><ActivityIndicator color={C.primary} /><Text style={styles.hint}>{t("Loading doctor…")}</Text></View>
      ) : !profile || doctor.error ? (
        <View style={styles.state}>
          <Text style={styles.sectionTitle}>{t("Could not load this doctor")}</Text>
          <Text style={styles.hint}>{doctor.error ?? t('The doctor may no longer be listed.')}</Text>
          <Pressable accessibilityRole="button" onPress={doctor.reload} style={styles.retry}><Text style={styles.link}>{t("Try again")}</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <Svg pointerEvents="none" width={288} height={288} viewBox="0 0 200 200" style={styles.waveOne}>
                <Path d="M42.7,-62.9C54.9,-54.1,64.1,-41.8,70.8,-27.7C77.4,-13.7,81.5,2.1,77.3,16.2C73.1,30.3,60.6,42.7,46.8,51.8C33.1,60.9,18,66.7,2.1,63.8C-13.8,60.9,-30.5,49.2,-43.3,37.3C-56.1,25.4,-65,13.2,-67.2,-0.7C-69.4,-14.7,-64.8,-30.4,-54.2,-41.5C-43.6,-52.6,-27,-59.1,-11.2,-61.7C4.6,-64.3,20.4,-63,42.7,-62.9Z" fill="#b6ebfb" />
              </Svg>
              <Svg pointerEvents="none" width={240} height={240} viewBox="0 0 200 200" style={styles.waveTwo}>
                <Path d="M37.5,-52.2C48.9,-42.6,58.7,-31.4,63.4,-18.2C68.1,-4.9,67.6,10.4,61.9,23.3C56.2,36.2,45.3,46.8,32.7,54.8C20,62.8,5.6,68.2,-8.1,66.7C-21.8,65.1,-34.7,56.6,-45.5,46.2C-56.2,35.8,-64.8,23.5,-67.7,9.6C-70.6,-4.3,-67.8,-19.9,-59.7,-31.9C-51.6,-43.8,-38.3,-52.2,-25.2,-60.8C-12.1,-69.3,0.7,-78,13.8,-73.4C26.9,-68.8,36.1,-50.8,37.5,-52.2Z" fill="#84f4fb" />
              </Svg>
              <View style={styles.heroActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("Call clinic")} onPress={() => Alert.alert(t('Contact the clinic'), t('A clinic phone number has not been provided. Please contact your hospital reception.'))} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}><BookingIcon name="phone" size={20} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t("Appointment options")} onPress={showOptions} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}><BookingIcon name="more" size={20} /></Pressable>
              </View>
              <View style={styles.profileRow}>
                <View style={styles.bio}>
                  <Text style={styles.specialty}>{t(profile.specialization)}</Text>
                  <Text style={styles.doctorName}>{profile.displayName || profile.name}</Text>
                  <View style={styles.tags}>{services.map(service => <View key={service} style={styles.tag}><Text style={styles.tagText}>{service}</Text></View>)}</View>
                </View>
                <View style={styles.portraitFrame}>
                  <Image source={profile.avatarUrl ? { uri: profile.avatarUrl } : require('../../../../assets/images/patient/booking-doctor.png')} style={styles.portrait} resizeMode="cover" />
                  <LinearGradient pointerEvents="none" colors={['transparent', C.pale]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
                </View>
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}><Text style={styles.statValue}>{profile.workingHours.start && profile.workingHours.end ? `${profile.workingHours.start}–${profile.workingHours.end}` : t('Hospital OPD')}</Text><Text style={styles.statLabel}>{t("Clinic hours")}</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{profile.avgConsultMinutes} {t("Minutes")}</Text><Text style={styles.statLabel}>{t("Consultation")}</Text></View>
              </View>
            </View>

            <View style={styles.tabs}>{(['Appointment', 'Schedule', 'About'] as const).map(item => (
              <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={styles.tab}>
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{t(item)}</Text>
                {tab === item && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}</View>

            {tab === 'About' ? (
              <View style={styles.aboutSection}>
                <Text style={styles.sectionTitle}>{t("About")}{' '}{profile.displayName || profile.name}</Text>
                <Text style={styles.aboutText}>{profile.about || t('Contact the clinic for more information about this doctor.')}</Text>
                {!!profile.qualifications && <Text style={styles.aboutText}>{profile.qualifications}</Text>}
                {!!profile.languages.length && <Text style={styles.hint}>{t("Languages:")}{' '}{profile.languages.map(value => t(value)).join(', ')}</Text>}
                {!!profile.room && <Text style={styles.hint}>{t("Clinic room:")}{' '}{profile.room}</Text>}
              </View>
            ) : (
              <>
                {tab === 'Appointment' && (
                  <View style={styles.modeSection}>
                    <View style={styles.segment}>{(['Hospital', 'Online'] as const).map(item => (
                      <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: mode === item }} onPress={() => setMode(item)} style={[styles.mode, mode === item && styles.modeActive]}>
                        <Text style={[styles.modeText, mode === item && styles.whiteText]}>{t(item)}</Text>
                      </Pressable>
                    ))}</View>
                    {mode === 'Online' && <Text style={styles.modeHint}>{t("Online consultations are not available yet. Choose Hospital to book a clinic slot.")}</Text>}
                  </View>
                )}

                <View style={styles.availability}>
                  <View style={styles.sectionHeading}>
                    <Text style={styles.sectionTitle}>{t("Available Date & Time")}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t("Browse available dates")} onPress={() => setCalendarOpen(true)} style={styles.calendarButton}><DesignImage name="arrow" size={20} color={C.primary} /></Pressable>
                  </View>
                  {date && <Text style={styles.dateContext}>{new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>}
                  {days.loading ? <ActivityIndicator style={styles.loading} color={C.primary} /> : days.error ? (
                    <View style={styles.notice}><Text style={styles.hint}>{days.error}</Text><Pressable accessibilityRole="button" onPress={days.reload}><Text style={styles.link}>{t("Try again")}</Text></Pressable></View>
                  ) : !availableDays.length ? <Text style={styles.hint}>
                    {days.data?.scheduleConfigured === false
                      ? t('This doctor has no clinic schedule configured yet. Please check again later.')
                      : t('No available dates. Please check again later.')}
                  </Text> : (
                    <ScrollView ref={dateStrip} horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip} contentContainerStyle={styles.dateContent}>
                      {availableDays.map(day => {
                        const parts = shortDayParts(day.date, locale);
                        const selected = day.date === date;
                        return <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={t("{value0}, {value1} slots available", { value0: String(longDayLabel(day.date, locale)), value1: String(day.slotsRemaining) })} accessibilityState={{ selected }} onPress={() => selectDate(day.date)} style={({ pressed }) => [styles.day, selected && styles.dayActive, pressed && styles.pressed]}>
                          <Text style={[styles.dayNumber, selected && styles.whiteText]}>{parts.day}</Text>
                          <Text style={[styles.weekday, selected && styles.selectedWeekday]}>{parts.weekday}</Text>
                        </Pressable>;
                      })}
                    </ScrollView>
                  )}
                  {date && (slots.loading || slots.data?.date !== date) && !slots.error ? <ActivityIndicator color={C.primary} style={styles.loading} /> : slots.error ? (
                    <View style={styles.notice}><Text style={styles.hint}>{slots.error}</Text><Pressable accessibilityRole="button" onPress={slots.reload}><Text style={styles.link}>{t("Retry times")}</Text></Pressable></View>
                  ) : date && !currentSlots.length ? <Text style={styles.hint}>{t("No clinic times for this day. Try another date.")}</Text> : (
                    <View style={styles.slotGrid}>{currentSlots.map(slot => {
                      const selected = slot.time === time;
                      return <View key={slot.id} style={styles.slotCell}><Pressable accessibilityRole="button" accessibilityState={{ selected, disabled: !slot.available }} accessibilityLabel={`${slot.time}, ${slot.available ? `${slot.remaining} slots remaining` : t("fully booked")}`} disabled={!slot.available} onPress={() => setTime(slot.time)} style={({ pressed }) => [styles.slot, selected && styles.slotActive, !slot.available && styles.slotUnavailable, pressed && styles.pressed]}>
                        <Text style={[styles.slotText, selected && styles.whiteText]}>{slot.time}</Text>
                      </Pressable></View>;
                    })}</View>
                  )}
                </View>

                {tab === 'Appointment' && !rescheduling && (
                  <View style={styles.form}>
                    <View>
                      <View style={styles.fieldHeading}><Text style={styles.fieldLabel}>{t("Your Symptom")}{' '}<Text style={styles.optional}>{t("(Optional)")}</Text></Text><Text style={styles.counter}>{reason.length}/300</Text></View>
                      <TextInput value={reason} onChangeText={setReason} multiline maxLength={300} placeholder={t("Describe how you are feeling or what hurts...")} placeholderTextColor={C.outline} style={styles.reasonInput} accessibilityLabel={t("Your symptom, optional")} />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>{t("Medical Document")}{' '}<Text style={styles.optional}>{t("(Optional)")}</Text></Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={t("Attach a medical document")} onPress={chooseDocument} style={({ pressed }) => [styles.uploadCard, pressed && styles.pressed]}>
                        <View style={styles.uploadIcon}><BookingIcon name="upload" color={C.secondary} /></View>
                        <View style={styles.uploadCopy}><Text style={styles.uploadTitle}>{selectedDocument?.name || t("Attach reports or scans")}</Text><Text style={styles.uploadHint} numberOfLines={1}>{selectedDocument ? t("This document will be attached to the appointment") : t("PDF, JPEG, PNG or WebP up to 10 MB")}</Text></View>
                        <BookingIcon name="plus" color={C.outline} size={20} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {bookingError ? (
              <Text accessibilityRole="alert" style={styles.bookingErrorText}>{bookingError}</Text>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit, busy: submitting }} disabled={!canSubmit} onPress={submit} style={({ pressed }) => [styles.cta, !canSubmit && styles.ctaDisabled, pressed && styles.pressed]}>
              {submitting ? <ActivityIndicator color={C.white} /> : <><Text style={styles.ctaLabel}>{rescheduling ? t('Confirm New Appointment') : t('Confirm Appointment')}</Text><BookingIcon name="check" size={18} color={C.white} /></>}
            </Pressable>
          </View>
        </>
      )}

      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.calendarSheet, { paddingBottom: Math.max(insets.bottom, 24) }]} accessibilityViewIsModal>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t("Choose an available date")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("Close date picker")} onPress={() => setCalendarOpen(false)} style={styles.calendarButton}><Text style={styles.link}>{t("Done")}</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.calendarDays}>
              {availableDays.map((day, index) => <Pressable key={day.date} accessibilityRole="button" accessibilityState={{ selected: date === day.date }} onPress={() => { selectDate(day.date); setCalendarOpen(false); dateStrip.current?.scrollTo({ x: index * 64, animated: true }); }} style={[styles.calendarDay, date === day.date && styles.modeActive]}>
                <Text style={[styles.fieldLabel, date === day.date && styles.whiteText]}>{longDayLabel(day.date, locale)}</Text><Text style={[styles.hint, date === day.date && styles.whiteText]}>{day.slotsRemaining} {t("slots available")}</Text>
              </Pressable>)}
              {!availableDays.length && <Text style={styles.hint}>
                {days.data?.scheduleConfigured === false
                  ? t('This doctor has no clinic schedule configured yet.')
                  : t('No available dates to display.')}
              </Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(bookingPass)} transparent animationType="fade" onRequestClose={viewBookedPass}>
        <View style={[styles.confirmationBackdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView style={styles.confirmationScroll} contentContainerStyle={styles.confirmationCard}>
            <View accessibilityViewIsModal style={styles.confirmationContent}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.confirmationTitle}>{t('Appointment confirmed')}</Text>
            <Text style={styles.confirmationSubtitle}>{t('Your queue and token details are ready.')}</Text>
            <Text style={styles.confirmationSubtitle}>{t('Show this QR code to the staff at your appointment.')}</Text>
            {bookingPass ? <PassQr value={bookingPass.qrValue} size={190} /> : null}
            {bookingPass ? <Text style={styles.confirmationToken}>{bookingPass.tokenLabel}</Text> : null}
            {bookingPass ? <Text style={styles.confirmationQueue}>{t('Queue number: {value0}', { value0: String(bookingPass.tokenNumber) })}</Text> : null}
            {bookingPass ? <Text style={styles.confirmationMeta}>{bookingPass.doctorName || t(bookingPass.department)} · {longDayLabel(bookingPass.queueDate, locale)}</Text> : null}
            {bookedTime ? <Text style={styles.confirmationMeta}>{t('Appointment time: {time}', { time: bookedTime })}</Text> : null}
            {uploadingDocument ? <View style={styles.confirmationUploading}><ActivityIndicator color={C.primary} /><Text accessibilityLiveRegion="polite" style={styles.confirmationSubtitle}>{t('Uploading your medical document...')}</Text></View> : null}
            {documentUploadError ? <Text accessibilityRole="alert" style={styles.confirmationError}>{t('The medical document could not be uploaded.')}{'\n'}{documentUploadError}</Text> : null}
            <View style={styles.confirmationActions}>
              {documentUploadError ? <Pressable accessibilityRole="button" onPress={() => { setBookingPass(null); router.replace('/(patient)/profile/reports'); }} style={styles.confirmationSecondary}><Text style={styles.confirmationSecondaryText}>{t('View reports')}</Text></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} onPress={viewBookedPass} style={[styles.confirmationPrimary, submitting && styles.ctaDisabled]}><Text style={styles.confirmationPrimaryText}>{t('View queue pass')}</Text></Pressable>
            </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  headerSafe: { backgroundColor: C.background, boxShadow: '0 1px 8px rgba(0,0,0,0.04)', zIndex: 1 },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backButton: { width: 44, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  profileButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 16 },
  hero: { backgroundColor: C.pale, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  waveOne: { position: 'absolute', right: -48, top: -32, opacity: 0.4 },
  waveTwo: { position: 'absolute', right: -16, top: 48, opacity: 0.3 },
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginBottom: 8 },
  heroButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bio: { flex: 1, minWidth: 0 },
  specialty: { color: C.secondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  doctorName: { color: C.text, fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: C.container, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  tagText: { color: C.muted, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  portraitFrame: { width: '41%', maxWidth: 144, height: 192, borderRadius: 16, overflow: 'hidden' },
  portrait: { width: '100%', height: '100%' },
  stats: { flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 8 },
  stat: { flex: 1 },
  statValue: { color: C.primary, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  statLabel: { color: C.muted, fontSize: 11, lineHeight: 14 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16 },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 8 },
  tabText: { color: C.outline, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  tabTextActive: { color: C.primary, fontWeight: '700' },
  tabUnderline: { height: 2, backgroundColor: C.primary, borderRadius: 1, position: 'absolute', left: '25%', right: '25%', bottom: 0 },
  modeSection: { marginHorizontal: 20, marginTop: 16, gap: 8 },
  segment: { backgroundColor: C.container, borderRadius: 30, padding: 4, flexDirection: 'row', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)' },
  mode: { flex: 1, borderRadius: 30, paddingVertical: 10, alignItems: 'center' },
  modeActive: { backgroundColor: C.primary },
  modeText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.text },
  modeHint: { color: C.muted, fontSize: 12, lineHeight: 17 },
  whiteText: { color: C.white },
  availability: { marginTop: 24, paddingHorizontal: 20, gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', flexShrink: 1 },
  calendarButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  dateContext: { color: C.outline, fontSize: 11, marginTop: -4 },
  dateStrip: { marginHorizontal: -20 },
  dateContent: { paddingHorizontal: 20, paddingVertical: 4, gap: 10 },
  day: { width: 54, paddingVertical: 12, borderRadius: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  dayActive: { backgroundColor: C.primary, boxShadow: '0 0 0 2px rgba(0,76,91,0.2), 0 2px 4px rgba(0,0,0,0.1)' },
  dayNumber: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: C.text },
  weekday: { fontSize: 11, lineHeight: 14, color: C.outline, marginTop: 2 },
  selectedWeekday: { color: '#afecff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, rowGap: 10, marginTop: 8 },
  slotCell: { width: '25%', paddingHorizontal: 5 },
  slot: { backgroundColor: C.white, borderRadius: 12, paddingVertical: 10, alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  slotActive: { backgroundColor: C.primary, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  slotUnavailable: { opacity: 0.4 },
  slotText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.text },
  form: { marginHorizontal: 20, marginTop: 24, gap: 16 },
  fieldHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldLabel: { color: C.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  optional: { color: C.outline, fontWeight: '400' },
  counter: { color: C.outline, fontSize: 11 },
  reasonInput: { minHeight: 106, padding: 16, backgroundColor: C.white, borderRadius: 16, fontSize: 14, lineHeight: 22, color: C.text, textAlignVertical: 'top', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  uploadCard: { marginTop: 6, padding: 16, borderRadius: 16, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  uploadIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  uploadCopy: { flex: 1, minWidth: 0 },
  uploadTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.text },
  uploadHint: { fontSize: 12, lineHeight: 16, color: C.outline, marginTop: 2 },
  confirmationBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(14,30,35,0.55)' },
  confirmationScroll: { width: '100%', maxWidth: 420, flexGrow: 0, borderRadius: 24, backgroundColor: C.white },
  confirmationCard: { padding: 24 },
  confirmationContent: { alignItems: 'center', gap: 10 },
  confirmationUploading: { alignItems: 'center', gap: 8 },
  confirmationTitle: { color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  confirmationSubtitle: { color: C.muted, fontSize: 14, textAlign: 'center' },
  confirmationToken: { color: C.primary, fontSize: 30, fontWeight: '800' },
  confirmationQueue: { color: C.text, fontSize: 18, fontWeight: '700' },
  confirmationMeta: { color: C.muted, fontSize: 13, textAlign: 'center' },
  confirmationError: { color: '#a12626', fontSize: 12, textAlign: 'center' },
  confirmationActions: { width: '100%', gap: 8, marginTop: 6 },
  confirmationPrimary: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  confirmationPrimaryText: { color: C.white, fontSize: 14, fontWeight: '700' },
  confirmationSecondary: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary },
  confirmationSecondaryText: { color: C.primary, fontSize: 14, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.background, boxShadow: '0 -4px 20px -2px rgba(14,30,35,0.06)' },
  bookingErrorText: { color: '#a12626', fontSize: 13, lineHeight: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  cta: { minHeight: 52, borderRadius: 30, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  ctaDisabled: { opacity: 0.45 },
  ctaLabel: { color: C.white, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  aboutSection: { marginHorizontal: 20, marginTop: 24, gap: 12 },
  aboutText: { color: C.muted, fontSize: 14, lineHeight: 22 },
  state: { flex: 1, padding: 24, gap: 12, alignItems: 'center', justifyContent: 'center' },
  hint: { color: C.outline, fontSize: 12, lineHeight: 18 },
  loading: { paddingVertical: 20 },
  notice: { gap: 8, paddingVertical: 12 },
  retry: { paddingVertical: 8 },
  link: { color: C.secondary, fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14,30,35,0.35)', justifyContent: 'flex-end' },
  calendarSheet: { maxHeight: '70%', padding: 20, backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16 },
  calendarDays: { gap: 8 },
  calendarDay: { padding: 16, borderRadius: 16, backgroundColor: C.white, gap: 4 },
});
