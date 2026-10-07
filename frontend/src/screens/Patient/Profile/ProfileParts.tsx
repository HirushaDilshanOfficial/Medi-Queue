import { LocalizedText as Text } from '../../../i18n/LocalizedText';
import { useLanguage } from '../../../i18n/LanguageContext';
import React from 'react';
import { Pressable, View } from 'react-native';
import { ProfileIcon, type ProfileIconName } from '../../../components/patient/ProfileIcon';
import type { MedicalReport, PatientProfile, VisitRecord } from '../../../types/patient';
import { C, styles } from './profileStyles';

export const isPrescription = (report: MedicalReport) => /prescription|^rx$/i.test(report.category);

export function IconButton({ icon, label, onPress, light = false }: {
  icon: ProfileIconName; label: string; onPress: () => void; light?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.iconButton, light && styles.lightButton, pressed && styles.pressed]}>
    <ProfileIcon name={icon} color={light ? C.white : C.muted} />
  </Pressable>;
}

export function Avatar({ patient, small = false }: { patient?: PatientProfile; small?: boolean }) {
  const words = patient?.fullName.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = words.length ? `${words[0][0]}${words.length > 1 ? words[words.length - 1][0] : ''}`.toUpperCase() : '';
  return <View style={[styles.avatar, small && styles.smallAvatar]}>
    {initials ? <Text style={[styles.avatarText, small && styles.smallAvatarText]}>{initials}</Text> :
      <ProfileIcon name="profile" size={small ? 18 : 36} color={C.primary} />}
  </View>;
}

export function Metric({ value, label, active = false }: { value: string; label: string; active?: boolean }) {
  const { t } = useLanguage();
  return <View style={styles.metric}><View style={styles.metricValueRow}><Text style={[styles.metricValue, active && { color: C.secondary }]}>{value}</Text>{active ? <View style={styles.activeDot} /> : null}</View><Text style={styles.metricLabel}>{t(label ?? '')}</Text></View>;
}

export function AccountRow({ icon, title, caption, onPress, iconColor }: {
  icon: ProfileIconName; title: string; caption: string; onPress: () => void; iconColor?: string;
}) {
  const { t } = useLanguage();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}>
    <View style={styles.roundIcon}><ProfileIcon name={icon} color={iconColor} /></View>
    <View style={styles.grow}><Text style={styles.rowTitle}>{t(title ?? '')}</Text><Text style={styles.caption}>{t(caption ?? '')}</Text></View><ProfileIcon name="arrow" size={16} color={C.muted} />
  </Pressable>;
}

export function EmptyState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return <View style={styles.empty}><Text style={styles.rowTitle}>{t(title ?? '')}</Text><Text style={styles.caption}>{body}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.moreButton}><Text style={styles.link}>{t("Try again")}</Text></Pressable> : null}</View>;
}

export function PersonalInfo({ patient, onEdit }: { patient?: PatientProfile; onEdit: () => void }) {
  const { t, locale } = useLanguage();
  return <View style={styles.section}>
    <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{t("Personal Information")}</Text><Pressable accessibilityRole="button" onPress={onEdit} style={styles.exportButton}><ProfileIcon name="edit" size={16} /><Text style={styles.link}>{t("Edit")}</Text></Pressable></View>
    {patient ? <View style={styles.infoCard}>{[
      ['Full name', patient.fullName], ['NIC', patient.nic], ['Phone', patient.phone], ['Email', patient.email],
      ['Birthday', patient.birthday ? new Date(patient.birthday).toLocaleDateString(locale, { timeZone: 'Asia/Colombo' }) : null],
      ['Gender', patient.gender], ['Address', patient.address], ['District', patient.district],
      ['Blood group', patient.bloodGroup], ['Allergies', patient.allergies.length ? patient.allergies.join(', ') : t('None recorded')],
    ].map(([label, value]) => <View key={label} style={styles.infoRow}><Text style={styles.caption}>{t(label ?? '')}</Text><Text style={styles.infoValue}>{value ?? t('Not added')}</Text></View>)}</View> : <EmptyState title={t("Profile unavailable")} body={t("Your details will appear once your profile loads.")} />}
  </View>;
}

export function VisitCard({ visit, reports, onExport, onNotes, onReports }: {
  visit: VisitRecord; reports: MedicalReport[]; onExport: () => void; onNotes: () => void; onReports: () => void;
}) {
  const { t } = useLanguage();
  const status = visit.status === 'completed' ? 'Completed' : visit.status.replace(/_/g, ' ');
  const prescription = reports.some(isPrescription);
  return <View style={styles.visitCard}>
    <View style={styles.visitHeading}>
      <View style={styles.squareIcon}><ProfileIcon name={/cardio/i.test(visit.department) ? 'heart' : /general/i.test(visit.department) ? 'stethoscope' : 'medical'} size={22} /></View>
      <View style={styles.grow}><Text style={styles.rowTitle}>{visit.department}</Text><Text style={styles.caption}>{visit.doctorName}</Text></View>
      <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusLabel}>{t(status)}</Text></View>
    </View>
    <View style={styles.visitDetails}>
      <View style={styles.visitDateRow}><ProfileIcon name="calendar" size={14} color={C.muted} /><Text style={styles.visitDate}>{visit.dateLabel ?? visit.date} • {visit.slotTime}</Text>
        {visit.tokenNumber !== null ? <View style={styles.tokenPill}><Text style={styles.tokenLabel}>{t('Queue')} #{visit.tokenNumber}</Text></View> : null}</View>
      <View><Text style={styles.reasonLabel}>{t("VISIT REASON")}</Text><Text style={styles.reason}>{visit.reason ?? t('No visit reason recorded.')}</Text></View>
    </View>
    <View style={styles.visitActions}>
      <Pressable accessibilityRole="button" onPress={onNotes} style={styles.actionChip}><ProfileIcon name="notes" size={15} /><Text style={styles.actionLabel}>{t("Visit Details")}</Text></Pressable>
      {reports.length ? <Pressable accessibilityRole="button" onPress={onReports} style={styles.actionChip}><ProfileIcon name={prescription ? 'pill' : 'clipboard'} size={15} /><Text style={styles.actionLabel}>{prescription ? t('Prescription (Rx)') : t('Lab Reports')}</Text></Pressable> : null}
      <View style={styles.grow} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("Export {value0} visit summary", { value0: String(visit.department) })} onPress={onExport} style={styles.downloadButton}><ProfileIcon name="download" size={16} /></Pressable>
    </View>
  </View>;
}
