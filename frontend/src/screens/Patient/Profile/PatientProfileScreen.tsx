import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
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
type Sheet = { title: string; body: string } | 'pass' | 'logout' | null;

export function PatientProfileScreen() {
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

  const exportVisits = async (items: VisitRecord[]) => {
    const text = ['Medi-Queue · OPD visit summary', patient?.fullName ?? '', ...items.map(visit =>
      [visit.department, visit.doctorName, `${visit.dateLong ?? visit.date} · ${visit.slotTime}`,
        `Status: ${visit.status.replace(/_/g, ' ')}`, visit.tokenNumber !== null ? `Queue #${visit.tokenNumber}` : '',
        visit.reason ? `Visit reason: ${visit.reason}` : ''].filter(Boolean).join('\n'))].join('\n\n');
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'mediqueue-visit-summary.txt'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else { await Share.share({ title: 'OPD visit summary', message: text }); }
    } catch { showMessage('Could not export visits', 'Please try again.'); }
  };

  const updateReminders = async (enabled: boolean) => {
    setSavingReminders(true);
    try { profile.setData(await patientApi.updateProfile({ remindersEnabled: enabled })); }
    catch { showMessage('Could not save reminders', 'Your preference was not changed. Please try again.'); }
    finally { setSavingReminders(false); }
  };
  const logout = async () => {
    setLoggingOut(true); setActionError(null);
    try { await clearAuthToken(); router.replace('/(auth)/login'); }
    catch { setActionError('Could not log out. Please try again.'); setLoggingOut(false); }
  };
  const notice = () => showMessage('Appointment reminders', pass
    ? `Your queue #${pass.tokenNumber} is ${pass.status.replace(/_/g, ' ')} at ${pass.department}. Open Queue to follow your turn.`
    : 'No active queue pass. Your reminder preference is available in Settings.');

  if (!fontsLoaded && !fontError) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.primary} accessibilityLabel="Loading profile" /></View>;

  const account = <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>Account &amp; Preferences</Text>
    <View style={styles.accountCard}>
      <AccountRow icon="family" title="Family & Dependents" caption="Manage linked family members"
        onPress={() => showMessage('Family & Dependents', 'Linked family members are not available for this account yet.')} />
      <AccountRow icon="emergency" title="Emergency & Donor Info" iconColor={C.error}
        caption={patient?.emergencyContact ? [patient.emergencyContact.name, patient.emergencyContact.phone].filter(Boolean).join(' · ') || 'Add an emergency contact' : 'Add an emergency contact'} onPress={editProfile} />
      <View style={styles.accountRow}>
        <View style={styles.roundIcon}><ProfileIcon name="bell" /></View>
        <View style={styles.grow}><Text style={styles.rowTitle}>SMS &amp; App Notifications</Text><Text style={styles.caption}>Queue reminders &amp; ready alerts</Text></View>
        <Switch accessibilityLabel="Appointment reminders" value={patient?.remindersEnabled ?? false}
          disabled={!patient || savingReminders} onValueChange={updateReminders}
          trackColor={{ false: C.high, true: C.primary }} thumbColor={C.white} />
      </View>
      <AccountRow icon="language" title="Language" caption="English"
        onPress={() => showMessage('Language', 'English is the current app language. Additional languages are not available yet.')} />
    </View>
  </View>;

  return <View style={styles.root}>
    <View style={[styles.headerSafe, { paddingTop: insets.top }]}><View style={styles.header}>
      <View style={styles.headerIcon}><ProfileIcon name="medical" size={20} /></View><Text style={styles.headerTitle}>Profile</Text><View style={styles.grow} />
      <IconButton icon="bell" label="Notifications" onPress={notice} />
      <Pressable accessibilityRole="button" accessibilityLabel="View personal information" onPress={() => setTab('Personal Info')} style={styles.headerAvatar}><Avatar patient={patient} small /></Pressable>
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
          <View style={styles.registeredPill}><View style={styles.aquaDot} /><Text style={styles.registeredText}>REGISTERED PATIENT</Text></View>
          <View style={styles.horizontal}><IconButton icon="qr" label="View queue health pass" onPress={() => setSheet('pass')} light /><IconButton icon="edit" label="Edit profile" onPress={editProfile} light /></View>
        </View>
        <View style={styles.identity}>
          <View style={styles.avatarFrame}><Avatar patient={patient} /></View>
          <View style={styles.grow}>
            <Text style={styles.patientName}>{patient?.fullName ?? (profile.loading ? 'Loading profile...' : 'Patient profile')}</Text>
            {patient ? <><Text style={styles.patientMeta}>{[patient.nic ? `NIC: ${patient.nic}` : null,
              patient.bloodGroup ? `Blood: ${patient.bloodGroup}` : null, patient.age !== null ? `${patient.age} Yrs` : null].filter(Boolean).join(' • ')}</Text>
              <View style={styles.idPill}><ProfileIcon name="badge" size={14} color={C.light} /><Text style={styles.idText}>#{patient.id.toUpperCase()}</Text></View></> : null}
          </View>
        </View>
      </View>
      <View style={styles.metricWrap}><View style={styles.metrics}>
        <Metric value={history.error || !history.data ? '—' : String(history.data.summary.totalVisits)} label="Past Visits" />
        <Metric value={queue.error || !queue.data ? '—' : pass ? '1' : '0'} label="Active Queue" active={Boolean(pass)} />
        <Metric value={history.error || !history.data ? '—' : String(prescriptions.length)} label="Prescriptions" />
      </View></View>
      {profile.error ? <View style={styles.section}><Text style={styles.error}>{profile.error}</Text><Pressable accessibilityRole="button" onPress={reloadProfile}><Text style={styles.link}>Retry profile</Text></Pressable></View> : null}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
          {TABS.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)}
            style={({ pressed }) => [styles.tab, tab === item && styles.selectedTab, pressed && styles.pressed]}><Text style={[styles.tabLabel, tab === item && styles.selectedLabel]}>{item}</Text></Pressable>)}
        </ScrollView>
      </View>
      {tab === 'Visit History' ? <>
        {pass ? <Pressable accessibilityRole="button" accessibilityLabel="View active queue" onPress={() => router.push('/(patient)/queue')} style={styles.queueWrap}>
          <LinearGradient colors={[C.container, C.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.queueBanner}>
            <View pointerEvents="none" style={styles.queueRing} /><View style={styles.queueIcon}><ProfileIcon name="ticket" size={22} color={C.aqua} /></View>
            <View style={styles.grow}><Text style={styles.queueTitle}>Queue #{pass.tokenNumber} {pass.status === 'in_consultation' ? 'In Progress' : pass.status === 'called' ? 'Called' : 'Waiting'}</Text>
              <Text style={styles.queueCaption}>{pass.department}{pass.live?.estimatedTurnAt ? ` • Est. ${new Date(pass.live.estimatedTurnAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}` : ''}</Text></View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>Active</Text></View><View style={styles.queueArrow}><ProfileIcon name="arrow" size={20} color={C.white} /></View>
          </LinearGradient>
        </Pressable> : null}
        {queue.error ? <View style={styles.section}><Text style={styles.error}>Your active queue could not be loaded.</Text></View> : null}
        <View style={styles.section}>
          <View style={styles.sectionHeading}><View style={styles.grow}><Text accessibilityRole="header" style={styles.sectionTitle}>Recent OPD Visits</Text><Text style={styles.caption}>Clinical records &amp; diagnostic consults</Text></View>
            <Pressable accessibilityRole="button" disabled={!visits.length} onPress={() => exportVisits(visits)} style={[styles.exportButton, !visits.length && styles.disabled]}><Text style={styles.link}>Export All</Text><ProfileIcon name="download" size={16} /></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.selectedTab]}>
              <Text style={[styles.filterLabel, filter === item && styles.selectedLabel]}>{item}{item === 'All Visits' ? ` (${visits.length})` : ''}</Text></Pressable>)}
          </ScrollView>
          {history.loading && !history.data ? <ActivityIndicator color={C.primary} /> : history.error ? <EmptyState title="Could not load your visits" body={history.error} onRetry={reloadHistory} /> : !filteredVisits.length ?
            <EmptyState title={visits.length ? 'No matching visits' : 'No visits yet'} body={visits.length ? 'Choose another filter to see your records.' : 'Your past clinic appointments will appear here.'} /> :
            filteredVisits.slice(0, 3).map(visit => <VisitCard key={visit.id} visit={visit} reports={reports.filter(report => report.appointmentId === visit.id)}
              onExport={() => exportVisits([visit])} onNotes={() => showMessage('Visit details', `${visit.doctorName}\n${visit.department}\n\n${visit.reason ? `Visit reason: ${visit.reason}` : 'No clinical notes have been shared for this visit.'}`)} onReports={() => setTab('Documents')} />)}
          {filteredVisits.length > 3 ? <Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/profile/history')} style={styles.moreButton}><Text style={styles.link}>View all visits</Text><ProfileIcon name="arrow" size={16} /></Pressable> : null}
        </View>
        <View style={styles.section}><View style={styles.vault}><View style={styles.roundIcon}><ProfileIcon name="folder" size={24} /></View>
          <View style={styles.grow}><Text style={styles.rowTitle}>Central Health Records</Text><Text style={styles.caption}>Your clinic documents and prescriptions</Text></View>
          <Pressable accessibilityRole="button" onPress={openReports} style={styles.vaultButton}><Text style={styles.link}>View All</Text></Pressable></View></View>
      </> : null}
      {tab === 'Personal Info' ? <PersonalInfo patient={patient} onEdit={editProfile} /> : null}
      {tab === 'Documents' ? <View style={styles.section}>
        <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Medical Documents</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(patient)/profile/report/new')} style={styles.exportButton}><Text style={styles.link}>Add report</Text></Pressable></View>
        {history.loading && !history.data ? <ActivityIndicator color={C.primary} /> : history.error ? <EmptyState title="Could not load documents" body={history.error} onRetry={reloadHistory} /> : reports.length ? reports.map(report =>
          <Pressable key={report.id} accessibilityRole="button" onPress={() => showMessage(report.title, [report.category, calendarDateLabel(report.reportDate), report.notes, report.fileName ? `File reference: ${report.fileName}` : null, 'The original document is held by the clinic.'].filter(Boolean).join('\n\n'))} style={styles.documentCard}>
            <View style={styles.squareIcon}><ProfileIcon name={isPrescription(report) ? 'pill' : 'clipboard'} /></View><View style={styles.grow}><Text style={styles.rowTitle}>{report.title}</Text><Text style={styles.caption}>{report.category} • {report.status === 'reviewed' ? 'Reviewed' : 'Pending review'}</Text></View><ProfileIcon name="arrow" size={16} /></Pressable>) : <EmptyState title="No documents yet" body="Add a lab report, referral or prescription to your profile." />}
        <Pressable accessibilityRole="button" onPress={openReports} style={styles.moreButton}><Text style={styles.link}>Manage medical reports</Text><ProfileIcon name="arrow" size={16} /></Pressable>
      </View> : null}
      {tab === 'Visit History' || tab === 'Settings' ? account : null}
      {tab === 'Settings' ? <View style={styles.section}><AccountRow icon="profile" title="Profile settings" caption="Personal, health and contact details" onPress={editProfile} /></View> : null}
      {tab === 'Visit History' || tab === 'Settings' ? <View style={styles.logoutWrap}>
        <Pressable accessibilityRole="button" onPress={() => { setActionError(null); setSheet('logout'); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}><ProfileIcon name="logout" size={20} color={C.error} /><Text style={styles.logoutLabel}>Log Out from Device</Text></Pressable>
      </View> : null}
    </ScrollView>
    <Modal transparent visible={sheet !== null} animationType="slide" onRequestClose={() => { if (!loggingOut) setSheet(null); }}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" disabled={loggingOut} onPress={() => setSheet(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sectionHeading}><View style={styles.grow}><Text accessibilityRole="header" style={styles.sectionTitle}>{sheet === 'pass' ? 'OPD Queue Health Pass' : sheet === 'logout' ? 'Log out of Medi-Queue?' : sheet?.title}</Text>
            {sheet === 'pass' ? <Text style={styles.caption}>Scan your active pass at hospital check-in</Text> : null}</View><IconButton icon="close" label="Close dialog" onPress={() => { if (!loggingOut) setSheet(null); }} /></View>
          {sheet === 'pass' ? pass ? <><View style={styles.qrFrame}><QRCode value={pass.qrValue} size={192} color={C.primary} /></View><View style={styles.passRecap}><Text style={styles.rowTitle}>{patient?.fullName}</Text><Text style={styles.caption}>Queue #{pass.tokenNumber} • {pass.department}</Text></View></> :
            <Text style={styles.sheetBody}>{queue.loading ? 'Loading your queue pass...' : queue.error ? 'Your pass could not be loaded. Open Queue to try again.' : 'You do not have an active queue pass. Open Queue on the day of your appointment to check in.'}</Text> :
            <Text style={styles.sheetBody}>{sheet === 'logout' ? 'Sign in again to access your profile and medical history.' : sheet?.body}</Text>}
          {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
          <Pressable accessibilityRole="button" disabled={loggingOut} onPress={sheet === 'logout' ? logout : () => setSheet(null)} style={[styles.sheetButton, loggingOut && styles.disabled]}><Text style={styles.sheetButtonLabel}>{sheet === 'logout' ? loggingOut ? 'Logging out...' : 'Log out' : 'Done'}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
