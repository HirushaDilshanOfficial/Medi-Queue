import { useLanguage } from '../../../i18n/LanguageContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { ReportDraft } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader } from '../../../components/patient/ScreenStates';
import { FormField, ChipGroup } from '../../../components/patient/FormField';
import { calendarDateLabel, dayLabel, todayKey } from '../../../utils/opdDates';

// Suggestions, not a closed list. The category is stored as free text so the
// hospital can add a type without needing an app release.
const CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'Lab result', label: 'Lab' },
  { value: 'Imaging', label: 'Imaging' },
  { value: 'Prescription', label: 'Prescription' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Discharge summary', label: 'Discharge' },
];

export function AddReportScreen() {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, category: requestedCategory } = useLocalSearchParams<{ id?: string; category?: string }>();
  const reportId = Array.isArray(id) ? id[0] : id;
  const prescriptionSubmission = !reportId && requestedCategory === 'Prescription';

  // Only visits can be linked, so the picker lists history rather than bookings.
  const history = useAsyncResource(() => patientApi.getHistory(), []);
  const existing = useAsyncResource(
    () => reportId ? patientApi.getReport(reportId) : Promise.resolve({ report: null }),
    [reportId],
  );

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(prescriptionSubmission ? 'Prescription' : 'General');
  const [reportDate, setReportDate] = useState('');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => new Date());
  const [openingFile, setOpeningFile] = useState(false);

  useFocusEffect(useCallback(() => {
    if (prescriptionSubmission) setCategory('Prescription');
  }, [prescriptionSubmission]));

  useEffect(() => {
    const report = existing.data?.report;
    if (!report) return;
    setTitle(report.title);
    setCategory(report.category);
    setReportDate(report.reportDate ? report.reportDate.slice(0, 10) : '');
    if (report.reportDate) setPickerDate(new Date(`${report.reportDate.slice(0, 10)}T12:00:00`));
    setFileName(report.fileName ?? '');
    setNotes(report.notes ?? '');
    setAppointmentId(report.appointmentId);
  }, [existing.data]);

  const linkableVisits = useMemo(
    () => (history.data?.visits ?? []).slice(0, 20),
    [history.data],
  );

  const onSubmit = useCallback(async () => {
  const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('Give the report a title so your doctor can find it.'));
      return;
    }

    if (reportDate.trim()) {
      const parsed = new Date(`${reportDate.trim()}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        setError(t('Check the report date. Use the format YYYY-MM-DD.'));
        return;
      }
      // A report cannot describe a test that has not happened yet, but a future
      // date is a plausible typo rather than an attempt to cheat, so it is a
      // form error rather than a rejection.
      if (parsed.getTime() > Date.now()) {
        setError(t('The report date cannot be in the future.'));
        return;
      }
    }

    setError(null);

    const draft: ReportDraft = {
      title: trimmedTitle,
      category,
      reportDate: reportDate.trim() || null,
      fileName: fileName.trim() || null,
      notes: notes.trim() || null,
      appointmentId,
    };

    setSaving(true);
    try {
      if (selectedFile && (selectedFile.size ?? 0) > 10 * 1024 * 1024) {
        setError(t('The report file must be 10 MB or smaller.'));
        return;
      }
      if (selectedFile || reportId) {
        const form = new FormData();
        Object.entries(draft).forEach(([key, value]) => {
          if (value !== undefined) form.append(key, value === null ? '' : String(value));
        });
        if (selectedFile?.file) {
          form.append('file', selectedFile.file);
        } else if (selectedFile) {
          form.append('file', {
            uri: selectedFile.uri,
            name: selectedFile.name || 'report',
            type: selectedFile.mimeType || 'application/octet-stream',
          } as unknown as Blob);
        }
        if (reportId) await patientApi.updateReport(reportId, form);
        else await patientApi.uploadReport(form);
      } else {
        await patientApi.createReport(draft);
      }
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t('Could not save your report.'),
      );
    } finally {
      setSaving(false);
    }
  }, [appointmentId, category, fileName, notes, reportDate, reportId, router, selectedFile, title, t]);

  const chooseFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if ((file.size ?? 0) > 10 * 1024 * 1024) {
      setError(t('The report file must be 10 MB or smaller.'));
      return;
    }
    setError(null);
    setSelectedFile(file);
    setFileName(file.name);
  }, [t]);

  const openDatePicker = useCallback(() => {
    if (reportDate) setPickerDate(new Date(`${reportDate}T12:00:00`));
    setDatePickerOpen(true);
  }, [reportDate]);

  const selectReportDate = useCallback((value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    setReportDate(`${year}-${month}-${day}`);
    setDatePickerOpen(false);
    setError(null);
  }, []);

  const openExistingFile = useCallback(async () => {
    const report = existing.data?.report;
    if (!report) return;
    setOpeningFile(true);
    try {
      await patientApi.openReportFile(report);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : t('Could not open the attached file.'));
    } finally {
      setOpeningFile(false);
    }
  }, [existing.data, t]);

  if ((history.loading && !history.data) || (reportId && existing.loading && !existing.data)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title={reportId ? t('Edit report') : prescriptionSubmission ? t('Submit prescription') : t('Lodge a report')} showBack />
        <ScreenLoader label={reportId ? t('Loading your report') : t('Loading your visits')} />
      </View>
    );
  }

  if (reportId && existing.error) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title={t("Edit report")} showBack />
        <View style={styles.loadError}>
          <Text style={styles.loadErrorTitle}>{t("Could not load this report")}</Text>
          <Text style={styles.loadErrorText}>{existing.error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={existing.reload}
            style={styles.retryButton}
          >
            <Text style={styles.retryLabel}>{t("Try again")}</Text>
          </Pressable>
        </View>
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
          title={reportId ? t('Edit report') : prescriptionSubmission ? t('Submit prescription') : t('Lodge a report')}
          subtitle={reportId ? t('Update the details for your doctor') : t('Tell your doctor what to look for')}
          showBack
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t("The report")}</Text>
          <FormField
            label={t("Title")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("Full blood count")}
            hint={t("How your doctor will recognise it")}
            maxLength={120}
          />
          <ChipGroup
            label={t("Category")}
            value={category}
            options={CATEGORIES}
            onChange={(value) => setCategory(value ?? 'General')}
          />
          <Text style={styles.dateLabel}>{t("Report date")}{' '}<Text style={styles.optional}>{t("(Optional)")}</Text></Text>
          {Platform.OS === 'web' ? (
            <View style={styles.dateButton}>
              <input
                type="date"
                value={reportDate}
                max={todayKey()}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setReportDate(value);
                  setError(null);
                }}
                style={styles.webDateInput}
                aria-label="Choose report date"
              />
            </View>
          ) : (
            <Pressable onPress={openDatePicker} style={styles.dateButton} accessibilityRole="button">
              <Text style={reportDate ? styles.dateValue : styles.datePlaceholder}>
                {calendarDateLabel(reportDate, locale) || t('Choose report date')}
              </Text>
            </Pressable>
          )}
          <Text style={styles.dateHint}>{t("The date printed on the report, not today")}</Text>
          <FormField
            label={t("File name")}
            value={fileName}
            onChangeText={setFileName}
            placeholder="blood-count-march.pdf"
            hint={t("The attached file name is filled in automatically")}
            optional
            maxLength={160}
          />
          <Pressable onPress={chooseFile} style={styles.fileButton} accessibilityRole="button">
            <Text style={styles.fileButtonLabel}>{selectedFile ? t('Change attached file') : t('Attach PDF or image')}</Text>
            <Text style={styles.fileButtonHint}>{selectedFile?.name ?? t('Maximum 10 MB')}</Text>
          </Pressable>
          {reportId && existing.data?.report.fileUrl && !selectedFile ? (
            <Pressable onPress={openExistingFile} style={styles.openFileButton} accessibilityRole="button" disabled={openingFile}>
              <Text style={styles.openFileLabel}>{openingFile ? t('Opening attached file...') : t('Open current attached file')}</Text>
              <Text style={styles.fileButtonHint}>{fileName}</Text>
            </Pressable>
          ) : null}
          <FormField
            label={t("Notes")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("Anything your doctor should know before reading it")}
            multiline
            optional
            maxLength={500}
          />
        </View>

        {linkableVisits.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t("Link to a visit")}</Text>
            <Text style={styles.groupHint}>
              {t("Optional. Links this report to a visit you already had.")}</Text>
            <Pressable
              onPress={() => setAppointmentId(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: appointmentId === null }}
              style={({ pressed }) => [
                styles.visit,
                appointmentId === null && styles.visitActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.visitTitle,
                  appointmentId === null && styles.visitTitleActive,
                ]}
              >
                {t("Not linked to a visit")}</Text>
            </Pressable>

            {linkableVisits.map((visit) => {
              const active = appointmentId === visit.id;
              return (
                <Pressable
                  key={visit.id}
                  onPress={() => setAppointmentId(visit.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.visit,
                    active && styles.visitActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.visitTitle, active && styles.visitTitleActive]}>
                    {visit.doctorName}
                  </Text>
                  <Text style={styles.visitMeta} numberOfLines={1}>
                    {[visit.department, dayLabel(visit.date, todayKey(), locale)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {history.error ? (
          <Text style={styles.inlineError}>
            {t("Could not load your visits, so the report will not be linked to one.")}</Text>
        ) : null}

        {error ? <Text style={styles.inlineError}>{t(error ?? '')}</Text> : null}
      </ScrollView>

      <Modal visible={Platform.OS !== 'web' && datePickerOpen} transparent animationType="slide" onRequestClose={() => setDatePickerOpen(false)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModal}>
            <View style={styles.dateModalActions}>
              <Pressable onPress={() => setDatePickerOpen(false)}><Text style={styles.dateAction}>{t("Cancel")}</Text></Pressable>
              <Pressable onPress={() => Platform.OS === 'web' ? setDatePickerOpen(false) : selectReportDate(pickerDate)}>
                <Text style={styles.dateAction}>{t("Done")}</Text>
              </Pressable>
            </View>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={reportDate}
                max={todayKey()}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value) setReportDate(value);
                }}
                style={styles.webDateInput}
                aria-label="Choose report date"
              />
            ) : (
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                maximumDate={new Date()}
                onChange={(_, value) => { if (value) setPickerDate(value); }}
              />
            )}
          </View>
        </View>
      </Modal>

      <View style={[styles.footer, { paddingBottom: insets.bottom + PatientTheme.spaceSm }]}>
        <Pressable
          onPress={onSubmit}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("Save report")}
          style={({ pressed }) => [
            styles.save,
            pressed && styles.pressed,
            saving && styles.saveDisabled,
          ]}
        >
          <Text style={styles.saveLabel}>{saving ? t('Saving...') : t('Save report')}</Text>
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
  fileButton: {
    borderWidth: 1,
    borderColor: PatientTheme.border,
    borderRadius: PatientTheme.radiusMd,
    padding: PatientTheme.spaceMd,
    marginTop: PatientTheme.spaceSm,
    backgroundColor: PatientTheme.surface,
  },
  fileButtonLabel: { color: PatientTheme.brand, fontWeight: '700' },
  fileButtonHint: { color: PatientTheme.textSecondary, marginTop: 4 },
  openFileButton: {
    borderWidth: 1,
    borderColor: PatientTheme.brand,
    borderRadius: PatientTheme.radiusMd,
    padding: PatientTheme.spaceMd,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  openFileLabel: { color: PatientTheme.brand, fontWeight: '700' },
  dateLabel: { color: PatientTheme.textPrimary, fontWeight: '700' },
  optional: { color: PatientTheme.textSecondary, fontWeight: '400' },
  dateButton: {
    borderWidth: 1,
    borderColor: PatientTheme.border,
    borderRadius: PatientTheme.radiusMd,
    padding: PatientTheme.spaceMd,
    backgroundColor: PatientTheme.surface,
  },
  dateValue: { color: PatientTheme.textPrimary },
  datePlaceholder: { color: PatientTheme.textSecondary },
  dateHint: { color: PatientTheme.textSecondary, fontSize: PatientTheme.designType.caption, marginTop: -8 },
  dateModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  dateModal: { backgroundColor: PatientTheme.surface, padding: PatientTheme.spaceLg, borderTopLeftRadius: PatientTheme.radiusLg, borderTopRightRadius: PatientTheme.radiusLg },
  dateModalActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: PatientTheme.spaceMd },
  dateAction: { color: PatientTheme.brand, fontWeight: '700', fontSize: PatientTheme.designType.body },
  webDateInput: {
    width: '100%',
    minHeight: 44,
    borderWidth: 0,
    padding: 0,
    boxSizing: 'border-box',
    fontSize: 16,
    color: PatientTheme.textPrimary,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
  } as React.CSSProperties,
  loadError: {
    margin: PatientTheme.spaceLg,
    padding: PatientTheme.spaceLg,
    borderRadius: PatientTheme.radiusMd,
    backgroundColor: PatientTheme.surface,
    borderWidth: 1,
    borderColor: PatientTheme.border,
  },
  loadErrorTitle: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  loadErrorText: {
    marginTop: PatientTheme.spaceSm,
    color: PatientTheme.textSecondary,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: PatientTheme.spaceMd,
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusPill,
    backgroundColor: PatientTheme.brand,
  },
  retryLabel: { color: PatientTheme.surface, fontWeight: '700' },
  group: {
    paddingHorizontal: PatientTheme.spaceLg,
    gap: PatientTheme.spaceMd,
  },
  groupTitle: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  groupHint: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  visit: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceMd,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    gap: 2,
  },
  visitActive: {
    borderColor: PatientTheme.brand,
    backgroundColor: PatientTheme.surfaceMuted,
  },
  visitTitle: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  visitTitleActive: {
    color: PatientTheme.brand,
  },
  visitMeta: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  inlineError: {
    paddingHorizontal: PatientTheme.spaceLg,
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.danger,
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
