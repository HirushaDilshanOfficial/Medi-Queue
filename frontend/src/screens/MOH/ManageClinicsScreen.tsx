import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { clinicApi, type Clinic } from '../../services/clinicApi';
import { http } from '../../services/http';
import { Colors } from '../../constants/Colors';

export default function ManageClinicsScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { hospitalId, hospitalName } = useLocalSearchParams<{ hospitalId?: string; hospitalName?: string }>();
  const id = Array.isArray(hospitalId) ? hospitalId[0] : hospitalId;
  const name = Array.isArray(hospitalName) ? hospitalName[0] : hospitalName;
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await http.get<{ clinics: Clinic[] }>(`/clinics/hospital/${id}`);
      setClinics(result.clinics);
    } catch (error) {
      Alert.alert(t('Could not load clinics'), error instanceof Error ? error.message : t('Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (clinic: Clinic) => {
    try {
      await http.patch(`/clinics/${clinic._id}`, { status: clinic.status === 'active' ? 'inactive' : 'active' });
      await load();
    } catch (error) {
      Alert.alert(t('Could not update clinic'), error instanceof Error ? error.message : t('Please try again.'));
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable>
        <View><Text style={styles.title}>{t("Manage clinics")}</Text><Text style={styles.subtitle}>{name || t('Hospital')}</Text></View>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : (
        <FlatList
          data={clinics}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.details}>{item.startTime}–{item.endTime} {t("· Capacity")}{' '}{item.maxPatients}</Text>
              </View>
              <Pressable onPress={() => toggle(item)} style={[styles.toggle, item.status === 'active' && styles.toggleActive]}>
                <Text style={[styles.toggleText, item.status === 'active' && styles.toggleTextActive]}>
                  {item.status === 'active' ? t('Enabled') : t('Enable')}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingTop: 52, backgroundColor: Colors.white },
  back: { fontSize: 36, color: Colors.primary, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textDark },
  subtitle: { color: Colors.textMedium, marginTop: 2 },
  loader: { marginTop: 40 },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  copy: { flex: 1 },
  name: { fontWeight: '800', color: Colors.textDark, fontSize: 16 },
  description: { color: Colors.textMedium, marginTop: 4 },
  details: { color: Colors.textLight, marginTop: 8, fontSize: 12 },
  toggle: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  toggleActive: { backgroundColor: Colors.primary },
  toggleText: { color: Colors.primary, fontWeight: '700' },
  toggleTextActive: { color: Colors.white },
});
