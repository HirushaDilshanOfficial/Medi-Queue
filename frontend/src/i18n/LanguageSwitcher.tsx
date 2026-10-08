import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSegments } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGUAGES, useLanguage, type Language } from './LanguageContext';
import { LocalizedText as Text } from './LocalizedText';
import { ProfileIcon } from '../components/patient/ProfileIcon';

/** Available before sign-in and throughout every role's navigation. */
export function LanguageSwitcher() {
  const { language, ready, setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Language>(language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const close = () => { if (!saving) setOpen(false); };
  const save = async () => {
    setSaving(true); setError(false);
    try { await setLanguage(selected); setOpen(false); }
    catch { setError(true); }
    finally { setSaving(false); }
  };

  const segments = useSegments();
  const isDark = ['(moh)', '(doctor)', '(reception)', 'notifications'].includes(segments[0]);
  const bgColor = isDark ? '#0a6e7e' : '#f3faff';
  const textColor = isDark ? '#ffffff' : '#004c5b';
  
  const firstSeg = segments[0] as string | undefined;
  if (firstSeg === '(auth)' || firstSeg === 'index' || segments.length === 0 || firstSeg === '(doctor)') {
    return null;
  }

  return <>
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.toolbar, { backgroundColor: bgColor }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Change language')}
        accessibilityState={{ disabled: !ready, expanded: open }} disabled={!ready}
        onPress={() => { setSelected(language); setError(false); setOpen(true); }} style={styles.control}>
        <ProfileIcon name="language" size={18} color={textColor} />
        <Text style={[styles.controlLabel, { color: textColor }]}>{t('Language')}</Text>
        <Text style={[styles.nativeLabel, { color: textColor }]}>{LANGUAGES.find(item => item.code === language)!.name}</Text>
        <ProfileIcon name="arrow" size={14} color={textColor} />
      </Pressable>
    </SafeAreaView>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('Close dialog')}
          disabled={saving} onPress={close} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{t('Language')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Close dialog')} disabled={saving} onPress={close} style={styles.close}>
              <ProfileIcon name="close" />
            </Pressable>
          </View>
          <Text style={styles.description}>{t('Choose your preferred language')}</Text>
          <Text style={styles.description}>{t('Applies to all screens')}</Text>
          <ScrollView style={styles.choices} accessibilityRole="radiogroup">
            {LANGUAGES.map(item => <Pressable key={item.code} accessibilityRole="radio" accessibilityLabel={item.name}
              accessibilityState={{ checked: selected === item.code, disabled: saving }} disabled={saving}
              onPress={() => setSelected(item.code)} style={[styles.choice, selected === item.code && styles.selected]}>
              <Text style={styles.nativeLabel}>{item.name}</Text>
              <View style={styles.radio}>{selected === item.code && <View style={styles.dot} />}</View>
            </Pressable>)}
          </ScrollView>
          {error && <Text accessibilityRole="alert" style={styles.error}>{t('Could not save language. Please try again.')}</Text>}
          <Pressable accessibilityRole="button" disabled={saving} accessibilityState={{ disabled: saving, busy: saving }}
            onPress={save} style={[styles.save, saving && styles.disabled]}>
            <Text style={styles.saveLabel}>{t(saving ? 'Saving...' : 'Done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  toolbar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d5e5ed', alignItems: 'flex-end' },
  control: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  controlLabel: { fontSize: 12 },
  nativeLabel: { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', fontSize: 15, lineHeight: 26 },
  overlay: { flex: 1, backgroundColor: 'rgba(36,51,57,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '100%', borderRadius: 24, padding: 24, backgroundColor: '#fff', gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: '#132228', fontSize: 20, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  description: { color: '#52666c', fontSize: 14 },
  choices: { flexShrink: 1 },
  choice: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { backgroundColor: '#e3f2f5' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#004c5b', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#004c5b' },
  error: { fontSize: 14, color: '#ba1a1a' },
  save: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: '#004c5b', borderRadius: 24, padding: 12 },
  saveLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
