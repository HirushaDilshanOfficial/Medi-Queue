import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';
import type { SlotOption } from '../../types/patient';

type Props = {
  slots: SlotOption[];
  selected: string | null;
  onSelect: (time: string) => void;
  loading?: boolean;
};

// Grid of times for the selected day. A slot that is sold out stays visible but
// disabled, so the shape of the day is obvious instead of silently shifting.
export function SlotGrid({ slots, selected, onSelect, loading }: Props) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{t("Checking availability...")}</Text>
      </View>
    );
  }

  if (!slots.length) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{t("No clinic times for this day. Try another date.")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const active = slot.time === selected;
        const soldOut = !slot.available;

        return (
          <Pressable
            key={slot.id}
            onPress={() => slot.available && onSelect(slot.time)}
            disabled={soldOut}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: soldOut }}
            accessibilityLabel={
              soldOut ? `${slot.time}, fully booked` : `${slot.time}, ${slot.remaining} left`
            }
            style={({ pressed }) => [
              styles.slot,
              active && styles.slotActive,
              soldOut && styles.slotSoldOut,
              pressed && slot.available && styles.slotPressed,
            ]}
          >
            <Text style={[styles.time, active && styles.textActive, soldOut && styles.textSoldOut]}>
              {slot.time}
            </Text>
            {soldOut ? (
              <Text style={styles.soldOutLabel}>{t("Full")}</Text>
            ) : (
              slot.remaining <= 3 && (
                <Text style={[styles.remaining, active && styles.textActive]}>
                  {slot.remaining} left
                </Text>
              )
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceLg,
  },
  slot: {
    minWidth: 74,
    flexGrow: 1,
    paddingVertical: PatientTheme.spaceSm,
    paddingHorizontal: PatientTheme.spaceSm,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.borderStrong,
    backgroundColor: PatientTheme.surface,
    alignItems: 'center',
  },
  slotActive: {
    backgroundColor: PatientTheme.brand,
    borderColor: PatientTheme.brand,
  },
  slotPressed: {
    opacity: 0.85,
  },
  slotSoldOut: {
    backgroundColor: PatientTheme.surfaceMuted,
    borderColor: PatientTheme.border,
  },
  time: {
    fontSize: PatientTheme.designType.item,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  remaining: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '600',
    color: PatientTheme.warning,
  },
  soldOutLabel: {
    marginTop: 1,
    fontSize: 9,
    color: PatientTheme.textMuted,
  },
  textActive: {
    color: PatientTheme.textOnBrand,
  },
  textSoldOut: {
    color: PatientTheme.textMuted,
    textDecorationLine: 'line-through',
  },
  placeholder: {
    paddingHorizontal: PatientTheme.spaceLg,
    paddingVertical: PatientTheme.spaceXl,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: PatientTheme.designType.body,
    color: PatientTheme.textMuted,
  },
});
