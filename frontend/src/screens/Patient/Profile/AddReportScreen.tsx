import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PatientTheme } from '../../../constants/PatientTheme';
import { patientApi } from '../../../services/patientApi';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import type { ReportDraft } from '../../../types/patient';
import { ScreenHeader } from '../../../components/patient/ScreenHeader';
import { ScreenLoader } from '../../../components/patient/ScreenStates';
import { FormField, ChipGroup } from '../../../components/patient/FormField';
import { dayLabel, todayKey } from '../../../utils/opdDates';

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
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Only visits can be linked, so the picker lists history rather than bookings.
  const history = useAsyncResource(() => patientApi.getHistory(), []);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [reportDate, setReportDate] = useState('');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkableVisits = useMemo(
    () => (history.data?.visits ?? []).slice(0, 20),
    [history.data],
  );

  const onSubmit = useCallback(async () => {
  const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give the report a title so your doctor can find it.');
      return;
    }

    if (reportDate.trim()) {
      const parsed = new Date(`${reportDate.trim()}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        setError('Check the report date. Use the format YYYY-MM-DD.');
        return;
      }
      // A report cannot describe a test that has not happened yet, but a future
      // date is a plausible typo rather than an attempt to cheat, so it is a
      // form error rather than a rejection.
      if (parsed.getTime() > Date.now()) {
        setError('The report date cannot be in the future.');
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
      await patientApi.createReport(draft);
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not save your report.',
      );
    } finally {
      setSaving(false);
    }
  }, [appointmentId, category, fileName, notes, reportDate, router, title]);

  if (history.loading && !history.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + PatientTheme.spaceSm }]}>
        <ScreenHeader title="Lodge a report" showBack />
        <ScreenLoader label="Loading your visits" />
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
          title="Lodge a report"
          subtitle="Tell your doctor what to look for"
          showBack
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <Text style={styles.groupTitle}>The report</Text>
          <FormField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Full blood count"
            hint="How your doctor will recognise it"
            maxLength={120}
          />
          <ChipGroup
            label="Category"
            value={category}
            options={CATEGORIES}
            onChange={(value) => setCategory(value ?? 'General')}
          />
          <FormField
            label="Report date"
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="YYYY-MM-DD"
            hint="The date printed on the report, not today"
            optional
            maxLength={10}
          />
          <FormField
            label="File name"
            value={fileName}
            onChangeText={setFileName}
            placeholder="blood-count-march.pdf"
            hint="Optional. Helps staff match it to the record they hold"
            optional
            maxLength={160}
          />
          <FormField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything your doctor should know before reading it"
            multiline
            optional
            maxLength={500}
          />
        </View>

        {linkableVisits.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Link to a visit</Text>
            <Text style={styles.groupHint}>
              Optional. Links this report to a visit you already had.
            </Text>
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
                Not linked to a visit
              </Text>
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
                    {[visit.department, dayLabel(visit.date, todayKey())]
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
            Could not load your visits, so the report will not be linked to one.
          </Text>
        ) : null}

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + PatientTheme.spaceSm }]}>
        <Pressable
          onPress={onSubmit}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save report"
          style={({ pressed }) => [
            styles.save,
            pressed && styles.pressed,
            saving && styles.saveDisabled,
          ]}
        >
          <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save report'}</Text>
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
