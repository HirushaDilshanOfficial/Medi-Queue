import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import {  StyleSheet, Pressable, ScrollView } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import type { BookableDay } from '../../types/patient';
import { shortDayParts } from '../../utils/opdDates';

type Props = {
  days: BookableDay[];
  selected: string | null;
  onSelect: (date: string) => void;
};

// Horizontal day selector. Only days the doctor actually has free slots for are
// listed, so a patient can never pick a date that then turns out to be closed.
export function DayStrip({ days, selected, onSelect }: Props) {
  const { t, locale } = useLanguage();
  if (!days.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {days.map((day) => {
        const { weekday, day: dayNumber, month } = shortDayParts(day.date, locale);
        const active = day.date === selected;

        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t("{value0} {value1} {value2}, {value3} slots free", { value0: String(weekday), value1: String(dayNumber), value2: String(month), value3: String(day.slotsRemaining) })}
            style={({ pressed }) => [
              styles.day,
              active && styles.dayActive,
              pressed && styles.dayPressed,
            ]}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>{weekday.toUpperCase()}</Text>
            <Text style={[styles.dayNumber, active && styles.textActive]}>{dayNumber}</Text>
            <Text style={[styles.month, active && styles.textActive]}>{month}</Text>
            <Text style={[styles.remaining, active && styles.textActive]}>
              {day.slotsRemaining} {t("free")}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceLg,
    paddingVertical: PatientTheme.spaceSm,
  },
  day: {
    width: 64,
    paddingVertical: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    alignItems: 'center',
    gap: 1,
  },
  dayActive: {
    backgroundColor: PatientTheme.brand,
    borderColor: PatientTheme.brand,
  },
  dayPressed: {
    opacity: 0.85,
  },
  weekday: {
    fontSize: 9,
    fontWeight: '700',
    color: PatientTheme.textMuted,
    letterSpacing: 0.4,
  },
  dayNumber: {
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
    color: PatientTheme.textPrimary,
  },
  month: {
    fontSize: 9,
    color: PatientTheme.textMuted,
  },
  remaining: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: PatientTheme.brand,
  },
  textActive: {
    color: PatientTheme.textOnBrand,
  },
});
