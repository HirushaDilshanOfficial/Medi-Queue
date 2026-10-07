import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View, StyleSheet, TextInput, Switch, Pressable, type TextInputProps } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

// Form primitives for the profile editor. They exist so every field in the
// edit sheet is laid out identically rather than each screen improvising its own
// input styling.

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  optional?: boolean;
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
  optional,
}: FieldProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>{t("Optional")}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={PatientTheme.textMuted}
        style={[styles.input, multiline && styles.inputMultiline, error ? styles.inputError : null]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
      {error ? (
        <Text style={styles.error}>{t(error)}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// `T` is the set of selectable values and deliberately excludes null, since
// "not set" is represented by the value being null rather than by an option.
type Option<T extends string> = {
  value: T;
  label: string;
};

type ChipGroupProps<T extends string> = {
  label: string;
  value: T | null;
  options: readonly Option<T>[];
  onChange: (value: T | null) => void;
  optional?: boolean;
};

// Horizontal single-select. `null` means "not set", which every one of these
// fields supports, so it is offered as its own chip rather than hidden.
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  optional,
}: ChipGroupProps<T>) {
  const { t } = useLanguage();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>{t("Optional")}</Text> : null}
      </View>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(active && optional ? null : option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {t(option.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ label, description, value, onValueChange }: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: PatientTheme.borderStrong, true: PatientTheme.brandSky }}
        thumbColor={value ? PatientTheme.brand : PatientTheme.surface}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: PatientTheme.spaceXs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '700',
    color: PatientTheme.textPrimary,
  },
  optional: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textMuted,
  },
  input: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: PatientTheme.spaceSm + 2,
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
    fontSize: PatientTheme.designType.item,
    color: PatientTheme.textPrimary,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: PatientTheme.spaceSm,
  },
  inputError: {
    borderColor: PatientTheme.danger,
  },
  error: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.danger,
  },
  hint: {
    fontSize: PatientTheme.designType.caption,
    color: PatientTheme.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PatientTheme.spaceSm,
  },
  chip: {
    paddingHorizontal: PatientTheme.spaceMd,
    paddingVertical: 6,
    borderRadius: PatientTheme.radiusPill,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: PatientTheme.surface,
  },
  chipActive: {
    backgroundColor: PatientTheme.brand,
    borderColor: PatientTheme.brand,
  },
  chipLabel: {
    fontSize: PatientTheme.designType.body,
    fontWeight: '600',
    color: PatientTheme.textSecondary,
  },
  chipLabelActive: {
    color: PatientTheme.textOnBrand,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PatientTheme.spaceMd,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
