import { StyleSheet } from 'react-native';

export const C = {
  background: '#f3faff',
  primary: '#004c5b',
  teal: '#176577',
  secondary: '#00696e',
  aqua: '#84f4fb',
  pale: '#e6f6ff',
  icon: '#e0f0f9',
  text: '#0e1e23',
  muted: '#3f484b',
};

const regular = 'ProfileInter400';
const medium = 'ProfileInter500';
const semibold = 'ProfileInter600';
const bold = 'ProfileInter700';
const shadow = '0 4px 18px rgba(0,76,91,0.06)';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scrollContent: { paddingBottom: 40 },

  // Full-width Screen Hero Header Backdrop
  fullHeroHeaderContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  heroBannerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  fullHeroOverlay: { width: '100%', paddingBottom: 24 },
  
  // Header controls on full hero backdrop
  header: { width: '100%', maxWidth: 1120, alignSelf: 'center', height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  eyebrowLight: { fontFamily: semibold, fontSize: 9, lineHeight: 12, letterSpacing: 1.2, color: C.aqua },
  headerTitleLight: { fontFamily: bold, fontSize: 16, lineHeight: 20, color: '#fff' },
  headerIconBtnLight: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarLight: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // Hero Content Floating over backdrop
  heroContentContainer: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  topHeroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topHeroGreeting: { fontFamily: bold, fontSize: 24, lineHeight: 30, color: '#fff' },
  topHeroSubtitle: { fontFamily: regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },
  topHeroIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  activeQueueEyebrow: { fontFamily: semibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, color: C.aqua, marginTop: 4 },
  
  // Glass Active Queue Card over Hero
  glassActiveQueueCard: { backgroundColor: 'rgba(255, 255, 255, 0.16)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)', borderRadius: 22, padding: 18, gap: 12 },
  activeQueueContainer: { gap: 12 },
  activeQueueHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeQueueBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  activeQueueTitle: { fontFamily: bold, fontSize: 15, lineHeight: 20, color: '#fff' },
  activeQueueSubline: { fontFamily: regular, fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.8)' },
  activeQueueArrowBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  whitePassBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: shadow },
  whitePassTitle: { fontFamily: bold, fontSize: 25, lineHeight: 30, color: C.text, letterSpacing: -0.5 },
  whitePassTime: { fontFamily: medium, fontSize: 11, lineHeight: 16, color: C.muted },
  roomTag: { backgroundColor: C.pale, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  roomTagText: { fontFamily: semibold, fontSize: 11, lineHeight: 15, color: C.primary },

  // Main Dashboard Content Container
  mainContainer: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 20 },

  // Book Doctor Appointment Card
  bookAppointmentCard: { backgroundColor: '#0a5a67', borderRadius: 20, padding: 18, gap: 12, boxShadow: shadow },
  bookCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  instantPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  instantPillText: { fontFamily: semibold, fontSize: 10, lineHeight: 14, color: C.aqua },
  liveSlotsTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.aqua },
  liveSlotsText: { fontFamily: bold, fontSize: 10, lineHeight: 14, color: C.primary },
  bookCardTitle: { fontFamily: bold, fontSize: 18, lineHeight: 24, color: '#fff' },
  bookCardBody: { fontFamily: regular, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)', maxWidth: 440 },
  bookCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: medium, fontSize: 11, lineHeight: 15, color: C.aqua },
  bookSlotButton: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookSlotButtonText: { fontFamily: bold, fontSize: 11, lineHeight: 15, color: C.primary },

  // Search Bar
  pillSearch: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.icon, boxShadow: shadow },
  pillSearchText: { flex: 1, fontFamily: regular, fontSize: 13, lineHeight: 18, color: C.muted },

  // Next Medical Checkup Bar
  checkupBar: { backgroundColor: C.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  checkupIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  checkupText: { fontFamily: semibold, fontSize: 13, lineHeight: 18, color: '#fff', flex: 1 },
  tomorrowBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.aqua },
  tomorrowBadgeText: { fontFamily: bold, fontSize: 11, lineHeight: 15, color: C.primary },

  // Quick Actions 5 Tile Row
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  quickActionTile: { alignItems: 'center', gap: 6, flex: 1 },
  quickActionIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: C.icon, alignItems: 'center', justifyContent: 'center', boxShadow: shadow },
  quickActionTileText: { fontFamily: semibold, fontSize: 10, lineHeight: 13, color: C.text, textAlign: 'center' },

  // Hospital Clinics 4 Column Circular Grid
  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  specialtyCircleTile: { alignItems: 'center', gap: 6, width: '22%', minWidth: 68 },
  specialtyCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  specialtyCircleLabel: { fontFamily: medium, fontSize: 11, lineHeight: 15, color: C.text, textAlign: 'center' },

  // General helpers
  section: { gap: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontFamily: bold, color: C.text, fontSize: 18, lineHeight: 26, letterSpacing: -0.3, flexShrink: 1 },
  sectionCaption: { fontFamily: regular, color: C.muted, fontSize: 12, lineHeight: 18 },
  link: { fontFamily: semibold, color: C.secondary, fontSize: 12, lineHeight: 18 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  status: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.pale },
  statusText: { flexShrink: 1, fontFamily: regular, fontSize: 13, lineHeight: 20, color: C.muted },
  error: { padding: 16, borderRadius: 16, backgroundColor: '#ffdad6', gap: 6 },
  errorTitle: { fontFamily: semibold, color: '#93000a', fontSize: 14, lineHeight: 20 },
  activityCard: { borderWidth: 1, borderColor: C.icon, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  activityRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityTitle: { fontFamily: semibold, color: C.text, fontSize: 13, lineHeight: 18 },
  activityCaption: { fontFamily: regular, color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  divider: { height: 1, backgroundColor: C.icon, marginHorizontal: 16 },
  emptyActivity: { padding: 20, gap: 6 },
  events: { marginHorizontal: -20 }, eventContent: { paddingHorizontal: 20, gap: 16, paddingBottom: 4 },
  eventCard: { width: 280, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: C.icon },
  eventImage: { width: '100%', height: 144 }, eventBody: { padding: 16, gap: 6 },
  eventBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  eventBadgeText: { fontFamily: semibold, fontSize: 10, lineHeight: 14, color: C.primary },
  eventTitle: { fontFamily: semibold, color: C.text, fontSize: 14, lineHeight: 20 },
  eventDescription: { fontFamily: regular, color: C.muted, fontSize: 12, lineHeight: 18 },
  eventSchedule: { flexShrink: 1, fontFamily: medium, color: C.secondary, fontSize: 11, lineHeight: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,76,91,0.35)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, backgroundColor: '#fff', gap: 16 },
  sheetBody: { fontFamily: regular, color: C.muted, fontSize: 14, lineHeight: 22 },
  sheetButton: { minHeight: 44, backgroundColor: C.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetButtonLabel: { fontFamily: semibold, color: '#fff', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
