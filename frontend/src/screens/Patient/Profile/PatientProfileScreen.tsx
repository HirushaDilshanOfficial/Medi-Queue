import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { LANGUAGES, useLanguage, type Language } from '../../../i18n/LanguageContext';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import Svg, { Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { patientApi } from '../../../services/patientApi';
import { queueApi } from '../../../services/queueApi';
import { clearAuthToken } from '../../../services/http';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { calendarDateLabel } from '../../../utils/opdDates';
import type { VisitRecord } from '../../../types/patient';
import { ProfileIcon } from '../../../components/patient/ProfileIcon';
import { AccountRow, Avatar, EmptyState, IconButton, isPrescription, Metric, PersonalInfo, VisitCard } from './ProfileParts';
import { C, styles } from './profileStyles';

const TABS = ['Visit History', 'Personal Info', 'Documents', 'Settings'] as const;
type Tab = typeof TABS[number];
const FILTERS = ['All Visits', 'Completed', 'Specialist Consults', 'Prescriptions'] as const;
type Filter = typeof FILTERS[number];
type Sheet = { title: string; body: string } | 'pass' | 'logout' | 'language' | null;

export function PatientProfileScreen() {
  const { t, language, setLanguage, ready, locale } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    ProfileInter400: require('../../../../assets/fonts/Inter-400.ttf'),
    ProfileInter500: require('../../../../assets/fonts/Inter-500.ttf'),
    ProfileInter600: require('../../../../assets/fonts/Inter-600.ttf'),
    ProfileInter700: require('../../../../assets/fonts/Inter-700.ttf'),
    ProfileInter800: require('../../../../assets/fonts/Inter-800.ttf'),
  });
  const profile = useAsyncResource(() => patientApi.getProfile(), []);
  const history = useAsyncResource(() => patientApi.getHistory(), []);
  const queue = useAsyncResource(() => queueApi.myPass(), []);
  const [tab, setTab] = useState<Tab>('Visit History');
  const [filter, setFilter] = useState<Filter>('All Visits');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasFocused = useRef(false);
  const { reload: reloadProfile } = profile;
  const { reload: reloadHistory } = history;
  const { reload: reloadQueue } = queue;

  useFocusEffect(useCallback(() => {
    // Resource hooks perform the first load; refresh on return from editing.
    if (hasFocused.current) { reloadProfile(); reloadHistory(); reloadQueue(); }
    hasFocused.current = true;
  }, [reloadProfile, reloadHistory, reloadQueue]));

  const patient = profile.data?.patient;
  const visits = history.data?.visits ?? [];
  const reports = history.data?.reports ?? [];
  const prescriptions = reports.filter(isPrescription);
  const pass = queue.data?.pass;
  const filteredVisits = useMemo(() => (history.data?.visits ?? []).filter(visit => {
    if (filter === 'Completed') return visit.status === 'completed';
    // Department names are the available specialty information in this API.
    if (filter === 'Specialist Consults') return !/general|primary|family medicine/i.test(visit.department);
    if (filter === 'Prescriptions') return (history.data?.reports ?? []).some(report => report.appointmentId === visit.id && isPrescription(report));
    return true;
  }), [history.data, filter]);
  const editProfile = () => router.push('/(patient)/profile/edit');
  const openReports = () => router.push('/(patient)/profile/reports');
  const showMessage = (title: string, body: string) => { setActionError(null); setSheet({ title, body }); };
  const closeSheet = () => { if (!loggingOut && !savingLanguage) setSheet(null); };
  const saveLanguage = async () => {
    setSavingLanguage(true); setActionError(null);
    try { await setLanguage(selectedLanguage); setSheet(null); }
    catch { setActionError(t('Could not save language. Please try again.')); }
    finally { setSavingLanguage(false); }
  };

  const exportVisits = async (items: VisitRecord[]) => {
    const text = [t('Medi-Queue · OPD visit summary'), patient?.fullName ?? '', ...items.map(visit =>
      [visit.department, visit.doctorName, `${visit.dateLong ?? visit.date} · ${visit.slotTime}`,
        t('Status: {status}', { status: t(visit.status) }), visit.tokenNumber !== null ? t('Queue #{number}', { number: visit.tokenNumber }) : '',
        visit.reason ? t('Visit reason: {reason}', { reason: visit.reason }) : ''].filter(Boolean).join('\n'))].join('\n\n');
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'mediqueue-visit-summary.txt'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else { await Share.share({ title: t('OPD visit summary'), message: text }); }
    } catch { showMessage(t('Could not export visits'), t('Please try again.')); }
  };

  const updateReminders = async (enabled: boolean) => {
    setSavingReminders(true);
    try { profile.setData(await patientApi.updateProfile({ remindersEnabled: enabled })); }
    catch { showMessage(t('Could not save reminders'), t('Your preference was not changed. Please try again.')); }
    finally { setSavingReminders(false); }
  };
  const logout = async () => {
    setLoggingOut(true); setActionError(null);
    try { await clearAuthToken(); router.replace('/(auth)/login'); }
    catch { setActionError(t('Could not log out. Please try again.')); setLoggingOut(false); }
  };
  const notice = () => showMessage(t('Appointment reminders'), pass
    ? t("Your queue #{value0} is {value1} at {value2}. Open Queue to follow your turn.", { value0: String(pass.tokenNumber), value1: t(pass.status), value2: String(pass.department) })
    : t('No active queue pass. Your reminder preference is available in Settings.'));

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.primary} accessibilityLabel={t("Loading profile")} /></View>;

  const account = <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{t("Account & Preferences")}</Text>
    <View style={styles.accountCard}>
      <AccountRow icon="family" title={t("Family & Dependents")} caption={t("Manage linked family members")}
        onPress={() => showMessage(t('Family & Dependents'), t('Linked family members are not available for this account yet.'))} />
      <AccountRow icon="emergency" title={t("Emergency & Donor Info")} iconColor={C.error}
        caption={patient?.emergencyContact ? [patient.emergencyContact.name, patient.emergencyContact.phone].filter(Boolean).join(' · ') || t('Add an emergency contact') : t('Add an emergency contact')} onPress={editProfile} />
      <View style={styles.accountRow}>
        <View style={styles.roundIcon}><ProfileIcon name="bell" /></View>
        <View style={styles.grow}><Text style={styles.rowTitle}>{t("SMS & App Notifications")}</Text><Text style={styles.caption}>{t("Queue reminders & ready alerts")}</Text></View>
        <Switch accessibilityLabel={t("Appointment reminders")} value={patient?.remindersEnabled ?? false}
          disabled={!patient || savingReminders} onValueChange={updateReminders}
          trackColor={{ false: C.high, true: C.primary }} thumbColor={C.white} />
      </View>
      <AccountRow icon="language" title={t("Language")} caption={LANGUAGES.find(item => item.code === language)!.name}
        onPress={() => { if (ready) { setSelectedLanguage(language); setActionError(null); setSheet('language'); } }} />
    </View>
  </View>;

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.headerIcon}><ProfileIcon name="medical" size={20} /></View><Text style={styles.headerTitle}>{t("Profile")}</Text><View style={styles.grow} />
      <IconButton icon="bell" label={t("Notifications")} onPress={notice} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("View personal information")} onPress={() => setTab('Personal Info')} style={styles.headerAvatar}><Avatar patient={patient} small /></Pressable>
    </View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(patient) && (profile.loading || history.loading || queue.loading)}
        onRefresh={() => { reloadProfile(); reloadHistory(); reloadQueue(); }} tintColor={C.primary} colors={[C.primary]} />}>
      <View style={styles.hero}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 400 240" preserveAspectRatio="none">
          <Path d="M-20 60 C80 140 180 10 280 90 C360 160 420 80 440 110 L440 0 L-20 0 Z" fill="white" opacity={0.2} />
          <Path d="M-10 180 C110 90 210 210 320 130 C380 90 410 140 430 160 L430 240 L-10 240 Z" fill={C.aqua} opacity={0.06} />
        </Svg>
        <View style={styles.heroActions}>
          <View style={styles.registeredPill}><View style={styles.aquaDot} /><Text style={styles.registeredText}>{t("REGISTERED PATIENT")}</Text></View>
          <View style={styles.horizontal}><IconButton icon="qr" label={t("View queue health pass")} onPress={() => setSheet('pass')} light /><IconButton icon="edit" label={t("Edit profile")} onPress={editProfile} light /></View>
        </View>
        <View style={styles.identity}>
          <View style={styles.avatarFrame}><Avatar patient={patient} /></View>
          <View style={styles.grow}>
            <Text style={styles.patientName}>{patient?.fullName ?? (profile.loading ? t('Loading profile...') : t('Patient profile'))}</Text>
            {patient ? <><Text style={styles.patientMeta}>{[patient.nic ? t('NIC: {nic}', { nic: patient.nic }) : null,
              patient.bloodGroup ? t('Blood: {group}', { group: patient.bloodGroup }) : null, patient.age !== null ? t('{age} Yrs', { age: patient.age }) : null].filter(Boolean).join(' • ')}</Text>
              <View style={styles.idPill}><ProfileIcon name="badge" size={14} color={C.light} /><Text style={styles.idText}>#{patient.id.toUpperCase()}</Text></View></> : null}
          </View>
        </View>
      </View>
      <View style={styles.metricWrap}><View style={styles.metrics}>
        <Metric value={history.error || !history.data ? '—' : String(history.data.summary.totalVisits)} label={t("Past Visits")} />
        <Metric value={queue.error || !queue.data ? '—' : pass ? '1' : '0'} label={t("Active Queue")} active={Boolean(pass)} />
        <Metric value={history.error || !history.data ? '—' : String(prescriptions.length)} label={t("Prescriptions")} />
      </View></View>
      {profile.error ? <View style={styles.section}><Text style={styles.error}>{profile.error}</Text><Pressable accessibilityRole="button" onPress={reloadProfile}><Text style={styles.link}>{t("Retry profile")}</Text></Pressable></View> : null}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
          {TABS.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)}
            style={({ pressed }) => [styles.tab, tab === item && styles.selectedTab, pressed && styles.pressed]}><Text style={[styles.tabLabel, tab === item && styles.selectedLabel]}>{t(item)}</Text></Pressable>)}
        </ScrollView>
      </View>
      {tab === 'Visit History' ? <>
        {pass ? <Pressable accessibilityRole="button" accessibilityLabel={t("View active queue")} onPress={() => router.push('/(patient)/queue')} style={styles.queueWrap}>
          <LinearGradient colors={[C.container, C.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.queueBanner}>
            <View pointerEvents="none" style={styles.queueRing} /><View style={styles.queueIcon}><ProfileIcon name="ticket" size={22} color={C.aqua} /></View>
            <View style={styles.grow}><Text style={styles.queueTitle}>{t("Queue #")}{pass.tokenNumber} {pass.status === 'in_consultation' ? t('In Progress') : pass.status === 'called' ? t('Called') : t('Waiting')}</Text>
              <Text style={styles.queueCaption}>{pass.department}{pass.live?.estimatedTurnAt ? t(" • Est. {value0}", { value0: String(new Date(pass.live.estimatedTurnAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })) }) : ''}</Text></View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>{t("Active")}</Text></View><View style={styles.queueArrow}><ProfileIcon name="arrow" size={20} color={C.white} /></View>
          </LinearGradient>
        </Pressable> : null}
        {queue.error ? <View style={styles.section}><Text style={styles.error}>{t("Your active queue could not be loaded.")}</Text></View> : null}
        <View style={styles.section}>
          <View style={styles.sectionHeading}><View style={styles.grow}><Text accessibilityRole="header" style={styles.sectionTitle}>{t("Recent OPD Visits")}</Text><Text style={styles.caption}>{t("Clinical records & diagnostic consults")}</Text></View>
            <Pressable accessibilityRole="button" disabled={!visits.length} onPress={() => exportVisits(visits)} style={[styles.exportButton, !visits.length && styles.disabled]}><Text style={styles.link}>{t("Export All")}</Text><ProfileIcon name="download" size={16} /></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.selectedTab]}>
              <Text style={[styles.filterLabel, filter === item && styles.selectedLabel]}>{t(item)}{item === 'All Visits' ? ` (${visits.length})` : ''}</Text></Pressable>)}
          </ScrollView>
          {history.loading && !history.data ? <ActivityIndicator color={C.primary} /> : history.error ? <EmptyState title={t("Could not load your visits")} body={history.error} onRetry={reloadHistory} /> : !filteredVisits.length ?
            <EmptyState title={visits.length ? t('No matching visits') : t('No visits yet')} body={visits.length ? t('Choose another filter to see your records.') : t('Your past clinic appointments will appear here.')} /> :
            filteredVisits.slice(0, 3).map(visit => <VisitCard key={visit.id} visit={visit} reports={reports.filter(report => report.appointmentId === visit.id)}
              onExport={() => exportVisits([visit])} onNotes={() => showMessage(t('Visit details'), `${visit.doctorName}\n${visit.department}\n\n${visit.reason ? `Visit reason: ${visit.reason}` : t('No clinical notes have been shared for this visit.')}`)} onReports={() => setTab('Documents')} />)}
          {filteredVisits.length > 3 ? <Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/profile/history')} style={styles.moreButton}><Text style={styles.link}>{t("View all visits")}</Text><ProfileIcon name="arrow" size={16} /></Pressable> : null}
        </View>
        <View style={styles.section}><View style={styles.vault}><View style={styles.roundIcon}><ProfileIcon name="folder" size={24} /></View>
          <View style={styles.grow}><Text style={styles.rowTitle}>{t("Central Health Records")}</Text><Text style={styles.caption}>{t("Your clinic documents and prescriptions")}</Text></View>
          <Pressable accessibilityRole="button" onPress={openReports} style={styles.vaultButton}><Text style={styles.link}>{t("View All")}</Text></Pressable></View></View>
      </> : null}
      {tab === 'Personal Info' ? <PersonalInfo patient={patient} onEdit={editProfile} /> : null}
      {tab === 'Documents' ? <View style={styles.section}>
        <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{t("Medical Documents")}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/profile/report/new')} style={styles.exportButton}><Text style={styles.link}>{t("Add report")}</Text></Pressable></View>
        {history.loading && !history.data ? <ActivityIndicator color={C.primary} /> : history.error ? <EmptyState title={t("Could not load documents")} body={history.error} onRetry={reloadHistory} /> : reports.length ? reports.map(report =>
          <Pressable key={report.id} accessibilityRole="button" onPress={() => showMessage(report.title, [report.category, calendarDateLabel(report.reportDate, locale), report.notes, report.fileName ? t('File reference: {file}', { file: report.fileName }) : null, t('The original document is held by the clinic.')].filter(Boolean).join('\n\n'))} style={styles.documentCard}>
            <View style={styles.squareIcon}><ProfileIcon name={isPrescription(report) ? 'pill' : 'clipboard'} /></View><View style={styles.grow}><Text style={styles.rowTitle}>{report.title}</Text><Text style={styles.caption}>{report.category} • {report.status === 'reviewed' ? t('Reviewed') : t('Pending review')}</Text></View><ProfileIcon name="arrow" size={16} /></Pressable>) : <EmptyState title={t("No documents yet")} body={t("Add a lab report, referral or prescription to your profile.")} />}
        <Pressable accessibilityRole="button" onPress={openReports} style={styles.moreButton}><Text style={styles.link}>{t("Manage medical reports")}</Text><ProfileIcon name="arrow" size={16} /></Pressable>
      </View> : null}
      {tab === 'Visit History' || tab === 'Settings' ? account : null}
      {tab === 'Settings' ? <View style={styles.section}><AccountRow icon="profile" title={t("Profile settings")} caption={t("Personal, health and contact details")} onPress={editProfile} /></View> : null}
      {tab === 'Visit History' || tab === 'Settings' ? <View style={styles.logoutWrap}>
        <Pressable accessibilityRole="button" onPress={() => { setActionError(null); setSheet('logout'); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}><ProfileIcon name="logout" size={20} color={C.error} /><Text style={styles.logoutLabel}>{t("Log Out from Device")}</Text></Pressable>
      </View> : null}
    </ScrollView>
    <Modal transparent visible={sheet !== null} animationType="slide" onRequestClose={closeSheet}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Close dialog")} disabled={loggingOut || savingLanguage} onPress={closeSheet} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sectionHeading}><View style={styles.grow}><Text accessibilityRole="header" style={styles.sectionTitle}>{sheet === 'language' ? t('Language') : sheet === 'pass' ? t('OPD Queue Health Pass') : sheet === 'logout' ? t('Log out of Medi-Queue?') : sheet?.title}</Text>
            {sheet === 'pass' ? <Text style={styles.caption}>{t("Scan your active pass at hospital check-in")}</Text> : null}</View><IconButton icon="close" label={t("Close dialog")} onPress={closeSheet} /></View>
          {sheet === 'language' ? <>
            <Text style={styles.sheetBody}>{t('Choose your preferred language')}</Text>
            <ScrollView accessibilityRole="radiogroup" style={{ flexShrink: 1 }}>
              {LANGUAGES.map(item => <Pressable key={item.code} accessibilityRole="radio"
                accessibilityLabel={item.name} accessibilityState={{ checked: selectedLanguage === item.code, disabled: savingLanguage }}
                disabled={savingLanguage} onPress={() => setSelectedLanguage(item.code)}
                style={[styles.accountRow, { minHeight: 56, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8 }, selectedLanguage === item.code && { backgroundColor: C.high }]}>
                <Text style={[styles.rowTitle, styles.grow, { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', lineHeight: 24 }]}>{item.name}</Text>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                  {selectedLanguage === item.code ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary }} /> : null}
                </View>
              </Pressable>)}
            </ScrollView>
          </> : sheet === 'pass' ? pass ? <><View style={styles.qrFrame}><QRCode value={pass.qrValue} size={192} color={C.primary} /></View><View style={styles.passRecap}><Text style={styles.rowTitle}>{patient?.fullName}</Text><Text style={styles.caption}>{t('Queue')} #{pass.tokenNumber} • {pass.department}</Text></View></> :
            <Text style={styles.sheetBody}>{queue.loading ? t('Loading your queue pass...') : queue.error ? t('Your pass could not be loaded. Open Queue to try again.') : t('You do not have an active queue pass. Open Queue on the day of your appointment to check in.')}</Text> :
            <Text style={styles.sheetBody}>{sheet === 'logout' ? t('Sign in again to access your profile and medical history.') : sheet?.body}</Text>}
          {actionError ? <Text accessibilityRole="alert" style={styles.error}>{t(actionError)}</Text> : null}
          <Pressable accessibilityRole="button" disabled={loggingOut || savingLanguage} onPress={sheet === 'logout' ? logout : sheet === 'language' ? saveLanguage : closeSheet} style={[styles.sheetButton, (loggingOut || savingLanguage) && styles.disabled]}><Text style={styles.sheetButtonLabel}>{savingLanguage ? t('Saving...') : sheet === 'logout' ? loggingOut ? t('Logging out...') : t('Log out') : t('Done')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
