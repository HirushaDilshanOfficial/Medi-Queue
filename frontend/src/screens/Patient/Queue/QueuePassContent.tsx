import React from 'react';
import { Image, Pressable, Switch, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { ProfileIcon } from '../../../components/patient/ProfileIcon';
import type { Doctor, QueuePass } from '../../../types/patient';
import { C, styles } from './queueStyles';

export function queueTime(value: string | null | undefined) {
  if (!value) return null;
  // Queue estimates currently arrive as display strings; check-in times are ISO.
  if (/^\d{1,2}:\d{2}(?:\s+[A-Z]{2,5})?$/.test(value.trim())) return value.trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });
}

function guidance(pass: QueuePass) {
  if (pass.status === 'called') return `Your number has been called. Go to ${pass.room ?? 'the clinic administration terminal'} now and show this QR code to the staff.`;
  if (pass.status === 'in_consultation') return 'Your consultation is under way. Follow up at the pharmacy desk if you need a prescription.';
  if (['completed', 'cancelled', 'no_show'].includes(pass.status)) return 'This queue pass is no longer active. Ask the clinic desk if you need further assistance.';
  return `Scan this QR code at the ${pass.department} administration terminal when your name is announced or your number appears on the display.`;
}

export function QueuePassContent({ pass, patientName, doctor, countdown, liveError, onHome, onWallet, onShare, onContact }: {
  pass: QueuePass; patientName: string; doctor?: Doctor | null; countdown: number; liveError: string | null;
  onHome: () => void; onWallet: () => void; onShare: () => void; onContact: () => void;
}) {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(120, Math.min(224, width - 120));
  const live = pass.live;
  const called = pass.status === 'called' || pass.status === 'in_consultation';
  const finished = ['completed', 'cancelled', 'no_show'].includes(pass.status);
  const turn = finished ? 'Pass closed' : called ? 'Now' : queueTime(live?.estimatedTurnAt) ?? 'Updating…';
  const ahead = finished ? 'Closed' : called ? 'Your turn' : live ? `Ahead: ${live.peopleAhead} ${live.peopleAhead === 1 ? 'Patient' : 'Patients'}` : 'Checking position';

  return <>
    <View style={styles.card}>
      <View style={styles.clinicRow}>
        <View style={styles.clinicIcon}><ProfileIcon name={/ortho/i.test(pass.department) ? 'spine' : 'medical'} size={22} color={C.secondary} /></View>
        <View style={styles.grow}><Text accessibilityRole="header" style={styles.title}>{pass.department}</Text><Text style={styles.small}>Registration time {queueTime(pass.checkedInAt) ?? '—'}</Text></View>
        <View style={styles.roomPill}><View style={styles.roomDot} /><Text style={styles.roomText}>{pass.room ?? 'Room pending'}</Text></View>
      </View>
      <View style={styles.numberPanel}>
        <Svg pointerEvents="none" style={styles.numberWave} viewBox="0 0 140 60" fill="none"><Path d="M0 45 C40 20 80 55 140 30" stroke="#1a6779" strokeWidth={2} opacity={0.2} /><Path d="M20 58 C60 35 95 62 140 42" stroke="#1a6779" strokeWidth={1.5} opacity={0.2} /></Svg>
        <View style={styles.numberRow}><Text style={styles.queueNumber}>Queue {pass.tokenNumber}</Text><View style={styles.aheadPill}><Text style={styles.aheadText}>{ahead}</Text></View></View>
        <Text style={styles.caption}>{finished ? 'This pass is no longer active' : called ? pass.status === 'in_consultation' ? 'Consultation in progress' : 'Please go to your consulting room' :
          live?.servingNow ? `Current Queue ${live.servingNow.tokenNumber} • Your position ${live.position}` : live ? `Your position: ${live.position}` : 'Your position updates automatically'}</Text>
      </View>
      <View style={styles.estimate}><View style={styles.inline}><ProfileIcon name="clock" color={C.light} /><Text style={styles.estimateLabel}>Your Turn at:</Text></View><Text style={styles.estimateValue}>{turn}</Text></View>
    </View>
    <View style={styles.guidance}><ProfileIcon name="info" color={C.secondary} /><Text accessibilityLiveRegion="polite" style={styles.guidanceBody}>{guidance(pass)}</Text></View>
    {liveError ? <View style={styles.guidance}><ProfileIcon name="refresh" color={C.error} /><Text accessibilityLiveRegion="polite" style={styles.error}>{liveError}</Text></View> : null}
    <View style={styles.qrCard}>
      {finished ? <Text style={styles.title}>Pass closed</Text> : <View style={styles.qrFrame}><QRCode value={pass.qrValue} size={qrSize} color={C.text} backgroundColor={C.surface} quietZone={8} /><View style={styles.scanDot} /></View>}
      <View style={styles.timer}><ProfileIcon name="refresh" size={16} color={C.secondary} /><Text style={styles.small}>{liveError ? 'Reconnecting to live queue…' : finished ? 'Live updates paused' : countdown > 0 ? <>Queue refreshes in <Text style={styles.timerStrong}>{countdown}s</Text></> : 'Refreshing queue…'}</Text></View>
      <View style={styles.metadata}>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Patient Name</Text><Text numberOfLines={1} style={styles.metaValue}>{patientName}</Text></View>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Queue Number</Text><Text style={styles.metaNumber}>{pass.tokenNumber}</Text></View>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>Reservation Date</Text><Text numberOfLines={1} style={styles.metaValue}>{pass.dateLong || pass.queueDate}</Text></View>
      </View>
    </View>
    <View style={styles.pharmacy}>
      <View style={styles.grow}><View style={styles.inline}><ProfileIcon name="medical" size={18} color={C.secondary} /><Text style={styles.title}>Pharmacy Queue</Text></View>
        <Text style={styles.caption}>Ask clinic staff to join the prescription queue after your check-up.</Text></View>
      <Switch value={false} disabled accessibilityLabel="Automatic pharmacy queue registration is not available" trackColor={{ false: '#bfc8cc', true: C.secondary }} thumbColor={C.surface} />
    </View>
    <View style={styles.specialist}>
      {doctor?.avatarUrl ? <Image source={{ uri: doctor.avatarUrl }} style={styles.doctorAvatar} /> : <View style={styles.doctorAvatar}><ProfileIcon name="stethoscope" size={24} /></View>}
      <View style={styles.grow}><Text style={styles.specialistEyebrow}>ATTENDING SPECIALIST</Text><Text style={styles.title}>{pass.doctorName ?? 'Assigned at the clinic'}</Text><Text style={styles.caption}>{doctor?.specialization ?? pass.department}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Clinic contact information" onPress={onContact} style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}><ProfileIcon name="phone" size={18} /></Pressable>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onHome} style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}><ProfileIcon name="home" color={C.surface} /><Text style={styles.homeLabel}>Back to Home</Text></Pressable>
      <View style={styles.secondaryActions}>
        <Pressable accessibilityRole="button" onPress={onWallet} style={({ pressed }) => [styles.walletButton, pressed && styles.pressed]}><ProfileIcon name="wallet" size={18} color={C.secondary} /><Text style={styles.actionLabel}>Add to Wallet</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share ticket" onPress={onShare} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}><ProfileIcon name="share" size={18} color={C.text} /></Pressable>
      </View>
    </View>
  </>;
}
