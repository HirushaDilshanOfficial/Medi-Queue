import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useShiftSummary } from '../../hooks';
import { downloadDailyReport, closeShift, getErrorMessage } from '../../services/api';
import {
  StatCard,
  SectionHeader,
  StatusChip,
  LoadingState,
  ErrorState,
  Toast,
  ToastType,
} from '../../components';

import { useShiftContext } from '../../context/ShiftContext';

export interface ReportsScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { data, loading, error, refreshing, refresh } = useShiftSummary();
  const { isShiftClosed, setIsShiftClosed } = useShiftContext();
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [closingShift, setClosingShift] = useState<boolean>(false);
  const [shiftClosed, setShiftClosed] = useState<boolean>(isShiftClosed);

  useEffect(() => {
    if (isShiftClosed) {
      setShiftClosed(true);
    }
  }, [isShiftClosed]);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const executeCloseShift = async () => {
    if (closingShift || shiftClosed) return;
    try {
      setClosingShift(true);
      await closeShift();
      setShiftClosed(true);
      setIsShiftClosed(true);
      showToast(t('Shift closed successfully. Summary snapshot saved.'), 'success');
      refresh(false);
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.toLowerCase().includes('already closed')) {
        setShiftClosed(true);
        setIsShiftClosed(true);
        showToast(t('Shift already closed'), 'warning');
      } else {
        const msg = getErrorMessage(err) || 'Failed to close shift';
        showToast(msg, 'error');
      }
    } finally {
      setClosingShift(false);
    }
  };

  const handleCloseShiftPress = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm("Close shift? This saves today's summary.")) {
        executeCloseShift();
      }
    } else {
      Alert.alert(
        t('Close shift?'),
        t("This saves today's summary."),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: 'Close Shift',
            style: 'destructive',
            onPress: executeCloseShift,
          },
        ],
        { cancelable: true }
      );
    }
  };

  const generateShiftReportHtml = (summary: any, csvData: string, dateStr: string): string => {
    const lines = (csvData || '').trim().split('\n');
    const rows = lines.slice(1).map((l) => l.split(','));

    const encountersHtml = rows
      .map(
        (cols, idx) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #006666;">${cols[0] || `OPD-${idx + 1}`}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">${cols[1] || '---'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #64748B;">${cols[2] || '---'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #64748B;">${cols[3] || '---'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #334155;">${cols[4] || '---'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #0284C7; font-weight: 600;">${cols[5] || '---'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; ${
            cols[7]?.toLowerCase().includes('done') || cols[7]?.toLowerCase().includes('checked')
              ? 'background: #DCFCE7; color: #15803D;'
              : cols[7]?.toLowerCase().includes('no_show')
              ? 'background: #FEF3C7; color: #B45309;'
              : 'background: #F1F5F9; color: #475569;'
          }">${cols[7] || 'active'}</span>
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #475569; text-align: center;">${cols[8] || '---'}</td>
      </tr>
    `
      )
      .join('');

    const doctorsHtml = (summary?.doctors || [])
      .map(
        (doc: any) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">${doc.name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; color: #64748B;">${doc.room || 'General OPD'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 700; color: #006666;">${doc.attended} / ${doc.capacity}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; ${
            doc.status === 'active' ? 'background: #DCFCE7; color: #15803D;' : 'background: #FEF3C7; color: #B45309;'
          }">${doc.status}</span>
        </td>
      </tr>
    `
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Medi-Queue Daily Shift Summary Report - ${dateStr}</title>
  <style>
    @media print {
      body { margin: 0; padding: 12mm; background: #fff !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 10mm; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1E293B; margin: 0; padding: 24px; background: #F8FAFC; }
    .report-wrap { max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #006666; padding-bottom: 18px; margin-bottom: 24px; }
    .hospital-title { font-size: 22px; font-weight: 800; color: #006666; margin: 0 0 4px 0; }
    .report-title { font-size: 14px; font-weight: 600; color: #64748B; margin: 0; }
    .meta-box { text-align: right; font-size: 12px; color: #64748B; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; }
    .kpi-num { font-size: 22px; font-weight: 800; color: #0F172A; margin-top: 4px; }
    .kpi-lbl { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .section-title { font-size: 15px; font-weight: 700; color: #0F172A; margin: 24px 0 10px 0; border-left: 4px solid #006666; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th { background: #F1F5F9; color: #475569; text-align: left; padding: 8px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #CBD5E1; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between; }
    .print-btn-bar { margin-bottom: 20px; text-align: right; }
    .print-btn { background: #006666; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="print-btn-bar no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="report-wrap">
    <div class="header-bar">
      <div>
        <h1 class="hospital-title">Medi-Queue Healthcare System</h1>
        <p class="report-title">End-of-Day Shift Audit & Encounter Report</p>
      </div>
      <div class="meta-box">
        <div><strong>Date:</strong> ${dateStr}</div>
        <div><strong>Shift:</strong> 08:00 - 16:30 (Counter 01)</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleTimeString()}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-lbl">Total Registered</div>
        <div class="kpi-num">${summary?.totalRegistered || rows.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Attended Patients</div>
        <div class="kpi-num" style="color: #15803D;">${summary?.attended || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">No-Shows</div>
        <div class="kpi-num" style="color: #B45309;">${summary?.noShows || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Throughput Rate</div>
        <div class="kpi-num" style="color: #0284C7;">${summary?.throughputPercent !== undefined ? summary.throughputPercent : 0}%</div>
      </div>
    </div>

    ${
      summary?.doctors && summary.doctors.length > 0
        ? `
      <div class="section-title">Physician Clinic Utilization</div>
      <table>
        <thead>
          <tr>
            <th>Consulting Doctor</th>
            <th>Room</th>
            <th style="text-align: center;">Attended / Capacity</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>${doctorsHtml}</tbody>
      </table>
    `
        : ''
    }

    <div class="section-title">Patient Encounter & Token Audit Log</div>
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th>Patient Name</th>
          <th>NIC</th>
          <th>Phone</th>
          <th>Doctor</th>
          <th>Dept</th>
          <th style="text-align: center;">Status</th>
          <th style="text-align: center;">Slot</th>
        </tr>
      </thead>
      <tbody>${
        encountersHtml ||
        '<tr><td colspan="8" style="text-align: center; padding: 16px; color: #94A3B8;">No encounter records recorded for this shift.</td></tr>'
      }</tbody>
    </table>

    <div class="footer">
      <span>Medi-Queue Official Audit Log • Confidential Medical Record</span>
      <span>Verified Counter 01 Reception Desk</span>
    </div>
  </div>
</body>
</html>`;
  };

  const handleExportDailyReport = async (format: 'csv' | 'pdf' = 'pdf') => {
    if (exporting) return;
    try {
      setExporting(true);
      setExportingFormat(format);
      const targetDate = data?.date;
      const csvData = await downloadDailyReport(targetDate);

      const dateStr =
        targetDate ||
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Colombo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());

      if (format === 'pdf') {
        const reportHtml = generateShiftReportHtml(data, csvData, dateStr);
        const fileName = `daily_shift_report_${dateStr}.html`;

        if (Platform.OS === 'web') {
          try {
            const printWindow = window.open('', '_blank', 'width=950,height=850');
            if (printWindow) {
              printWindow.document.open();
              printWindow.document.write(reportHtml);
              printWindow.document.close();
              printWindow.focus();
              setTimeout(() => {
                try {
                  printWindow.print();
                } catch (e) {}
              }, 500);
            }
          } catch (e) {
            console.log('Print window error:', e);
          }

          const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast(t('Daily PDF report generated successfully'), 'success');
        } else {
          const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
          if (!baseDir) {
            showToast(t('Device storage is not accessible'), 'error');
            return;
          }
          const fileUri = `${baseDir}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, reportHtml, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/html',
              dialogTitle: 'Export Daily Shift Report',
            });
          }
          showToast(t('Daily report generated successfully'), 'success');
        }
      } else {
        if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
          showToast(t('No report data available to export for today'), 'warning');
          return;
        }

        const fileName = `daily_report_${dateStr}.csv`;

        if (Platform.OS === 'web') {
          const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast(t('Daily CSV report downloaded successfully'), 'success');
        } else {
          const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
          if (!baseDir) {
            showToast(t('Device storage is not accessible'), 'error');
            return;
          }
          const fileUri = `${baseDir}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, csvData, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Export Daily Shift Report',
              UTI: 'public.comma-separated-values-text',
            });
          }
          showToast(t('Daily report exported successfully'), 'success');
        }
      }
    } catch (err: any) {
      const msg = getErrorMessage(err) || 'Failed to export daily report';
      showToast(msg, 'error');
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  // Format today's date
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Calculate breakdown numbers and percentages
  const total = data?.totalRegistered || 0;
  const attended = data?.attended || 0;
  const noShows = data?.noShows || 0;
  const cancelled = data?.cancelled || 0;
  const inProgress = Math.max(0, total - (attended + noShows + cancelled));

  const throughputPercent =
    data?.throughputPercent !== undefined
      ? data.throughputPercent
      : total > 0
      ? Math.round((attended / total) * 100)
      : 0;

  const isGoalMet = throughputPercent >= 95;
  const goalColor = isGoalMet ? Colors.success : Colors.warning;

  const attendedPct = total > 0 ? Math.round((attended / total) * 100) : 0;
  const noShowsPct = total > 0 ? Math.round((noShows / total) * 100) : 0;
  const cancelledPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.max(0, 100 - (attendedPct + noShowsPct + cancelledPct)) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── DARK TEAL HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="document-text" size={20} color={Colors.white} />
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t("End-of-Day Summary")}</Text>
            <View style={styles.headerMetaRow}>
              <View style={styles.headerMetaItem}>
                <Ionicons name="calendar-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
                <Text style={styles.headerSubtitle}>{todayFormatted}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.headerMetaItem}>
                <Ionicons name="time-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
                <Text style={styles.headerSubtitle}>{t("Shift: 08:00 - 16:30")}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshIconButton}
          onPress={() => refresh(true)}
          activeOpacity={0.7}
          disabled={loading || refreshing}
          accessibilityRole="button"
          accessibilityLabel={t("Refresh shift summary")}
        >
          <Ionicons
            name="refresh"
            size={18}
            color={Colors.white}
            style={refreshing ? styles.rotatingIcon : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* ── BODY CONTENT ── */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh(true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {loading && !data ? (
          <View style={styles.stateContainer}>
            <LoadingState
              message={t("Loading End-of-Day Summary...")}
              size="large"
              fullscreen={false}
            />
          </View>
        ) : error && !data ? (
          <View style={styles.stateContainer}>
            <ErrorState
              title={t("Unable to Load Summary")}
              message={error}
              onRetry={() => refresh(false)}
              retryLabel="Retry Summary"
              fullscreen={false}
            />
          </View>
        ) : (
          <>
            {/* ── SHIFT PERFORMANCE STATS SECTION ── */}
            <View style={styles.section}>
              <SectionHeader
                title={t("Shift Performance")}
                subtitle={t("Daily clinic throughput & handling efficiency")}
              />

              <View style={styles.statsGrid}>
                {/* 1. Total Registered */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title={t("Total Registered")}
                    value={total}
                    subtitle={t("Total patient intake")}
                    iconName="people-outline"
                    variant="primary"
                  />
                </View>

                {/* 2. Attended */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title={t("Attended")}
                    value={attended}
                    subtitle={t("{value0}% completed", { value0: String(attendedPct) })}
                    iconName="checkmark-circle-outline"
                    variant="success"
                  />
                </View>

                {/* 3. No-Shows / Cancelled */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title={t("No-Shows / Cancelled")}
                    value={`${noShows} / ${cancelled}`}
                    subtitle={t("{value0} missed visits", { value0: String(noShows + cancelled) })}
                    iconName="alert-circle-outline"
                    variant="warning"
                  />
                </View>

                {/* 4. Counter Handling avg */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title={t("Counter Handling avg")}
                    value={t('{minutes} min', { minutes: data?.avgHandlingMinutes ?? 0 })}
                    subtitle={t("Average consultation time")}
                    iconName="time-outline"
                    variant="default"
                  />
                </View>
              </View>
            </View>

            {/* ── QUEUE THROUGHPUT CARD ── */}
            <View style={styles.section}>
              <SectionHeader
                title={t("Queue Throughput")}
                subtitle={t("Operational efficiency vs daily target")}
              />

              <View style={styles.throughputCard}>
                {/* Card Top / Header */}
                <View style={styles.throughputHeaderRow}>
                  <View style={styles.throughputTitleLeft}>
                    <View style={[styles.throughputIconBadge, { backgroundColor: `${goalColor}18` }]}>
                      <Ionicons
                        name={isGoalMet ? 'checkmark-circle' : 'trending-up'}
                        size={18}
                        color={goalColor}
                      />
                    </View>
                    <View>
                      <Text style={styles.throughputCardTitle}>{t("Shift Completion")}</Text>
                      <Text style={styles.throughputCardSubtitle}>{t("95% Efficiency Benchmark")}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.goalBadge,
                      {
                        backgroundColor: isGoalMet ? '#ECFDF5' : '#FFFBEB',
                        borderColor: isGoalMet ? '#A7F3D0' : '#FDE68A',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isGoalMet ? 'ribbon' : 'alert-circle'}
                      size={13}
                      color={goalColor}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.goalBadgeText, { color: goalColor }]}>
                      {isGoalMet ? t('Goal Met (≥95%)') : t('Below 95% Target')}
                    </Text>
                  </View>
                </View>

                {/* Hero Throughput Metric */}
                <View style={styles.heroThroughputBox}>
                  <View style={styles.heroThroughputRow}>
                    <View>
                      <Text style={styles.heroThroughputLabel}>{t("Throughput Rate")}</Text>
                      <Text style={styles.heroThroughputSub}>
                        {isGoalMet ? t('Exceeding target') : 'Target gap: ' + (95 - throughputPercent).toFixed(1) + '%'}
                      </Text>
                    </View>
                    <View style={styles.heroThroughputValueWrap}>
                      <Text style={[styles.heroThroughputPercent, { color: goalColor }]}>
                        {throughputPercent}%
                      </Text>
                      <Text style={styles.heroGoalTarget}> {t("/ 95% Goal")}</Text>
                    </View>
                  </View>

                  {/* Main Throughput Progress Bar */}
                  <View style={styles.heroProgressBarTrack}>
                    <View
                      style={[
                        styles.heroProgressBarFill,
                        {
                          width: `${Math.min(Math.max(throughputPercent, 0), 100)}%`,
                          backgroundColor: goalColor,
                        },
                      ]}
                    />
                    {/* 95% Goal Marker */}
                    <View style={styles.goalMarkerLine} />
                  </View>

                  {/* Goal Scale Axis Labels */}
                  <View style={styles.scaleRow}>
                    <Text style={styles.scaleText}>0%</Text>
                    <Text style={styles.scaleGoalText}>{t("95% Target Goal")}</Text>
                    <Text style={styles.scaleText}>100%</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Individual Breakdown Progress Bars */}
                <Text style={styles.breakdownHeading}>{t("Status Breakdown")}</Text>

                <View style={styles.breakdownList}>
                  {/* 1. Attended */}
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownLabelRow}>
                      <View style={styles.breakdownLabelLeft}>
                        <View style={[styles.dotIndicator, { backgroundColor: Colors.success }]} />
                        <Text style={styles.breakdownLabel}>{t("Attended")}</Text>
                      </View>
                      <Text style={styles.breakdownValue}>
                        <Text style={styles.breakdownCount}>{attended}</Text> ({attendedPct}%)
                      </Text>
                    </View>
                    <View style={styles.breakdownBarTrack}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          {
                            width: `${Math.min(attendedPct, 100)}%`,
                            backgroundColor: Colors.success,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* 2. No-Shows */}
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownLabelRow}>
                      <View style={styles.breakdownLabelLeft}>
                        <View style={[styles.dotIndicator, { backgroundColor: Colors.warning }]} />
                        <Text style={styles.breakdownLabel}>{t("No-Shows")}</Text>
                      </View>
                      <Text style={styles.breakdownValue}>
                        <Text style={styles.breakdownCount}>{noShows}</Text> ({noShowsPct}%)
                      </Text>
                    </View>
                    <View style={styles.breakdownBarTrack}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          {
                            width: `${Math.min(noShowsPct, 100)}%`,
                            backgroundColor: Colors.warning,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* 3. Cancelled */}
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownLabelRow}>
                      <View style={styles.breakdownLabelLeft}>
                        <View style={[styles.dotIndicator, { backgroundColor: '#94A3B8' }]} />
                        <Text style={styles.breakdownLabel}>{t("Cancelled")}</Text>
                      </View>
                      <Text style={styles.breakdownValue}>
                        <Text style={styles.breakdownCount}>{cancelled}</Text> ({cancelledPct}%)
                      </Text>
                    </View>
                    <View style={styles.breakdownBarTrack}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          {
                            width: `${Math.min(cancelledPct, 100)}%`,
                            backgroundColor: '#94A3B8',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* 4. In Progress / Waiting (if any) */}
                  {inProgress > 0 && (
                    <View style={styles.breakdownItem}>
                      <View style={styles.breakdownLabelRow}>
                        <View style={styles.breakdownLabelLeft}>
                          <View style={[styles.dotIndicator, { backgroundColor: Colors.primaryLight }]} />
                          <Text style={styles.breakdownLabel}>{t("In Waiting Queue")}</Text>
                        </View>
                        <Text style={styles.breakdownValue}>
                          <Text style={styles.breakdownCount}>{inProgress}</Text> ({inProgressPct}%)
                        </Text>
                      </View>
                      <View style={styles.breakdownBarTrack}>
                        <View
                          style={[
                            styles.breakdownBarFill,
                            {
                              width: `${Math.min(inProgressPct, 100)}%`,
                              backgroundColor: Colors.primaryLight,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* ── DOCTOR SCHEDULES & ROSTER SECTION ── */}
            <View style={styles.section}>
              <SectionHeader
                title={t("Doctor Schedules & Roster")}
                subtitle={t("Physician consultation progress & room allocation")}
              />

              {!data?.doctors || data.doctors.length === 0 ? (
                <View style={styles.emptyDoctorCard}>
                  <View style={styles.emptyDoctorIconWrap}>
                    <Ionicons name="medkit-outline" size={28} color={Colors.textLight} />
                  </View>
                  <Text style={styles.emptyDoctorTitle}>{t("No Doctors Scheduled")}</Text>
                  <Text style={styles.emptyDoctorSubtitle}>
                    {t("There are no rostered doctors assigned for this shift.")}</Text>
                </View>
              ) : (
                <View style={styles.doctorsList}>
                  {data.doctors.map((doc) => {
                    const capacity = doc.capacity || 30;
                    const attendedCount = doc.attended || 0;
                    const docCapPct = capacity > 0 ? Math.min(100, Math.round((attendedCount / capacity) * 100)) : 0;
                    const isFull = attendedCount >= capacity;

                    return (
                      <View key={doc._id || doc.name} style={styles.doctorCard}>
                        {/* Doctor Card Top Row */}
                        <View style={styles.doctorTopRow}>
                          <View style={styles.doctorInfoLeft}>
                            <View style={styles.doctorAvatar}>
                              <Ionicons name="person" size={18} color={Colors.primary} />
                            </View>
                            <View style={styles.doctorNameWrap}>
                              <Text style={styles.doctorName} numberOfLines={1}>
                                {doc.name}
                              </Text>
                              <View style={styles.doctorMetaRow}>
                                {doc.room ? (
                                  <View style={styles.roomTag}>
                                    <Ionicons name="business-outline" size={11} color={Colors.primary} style={{ marginRight: 3 }} />
                                    <Text style={styles.roomTagText}>
                                      {doc.room.toLowerCase().startsWith('room') ? doc.room : t("Room {value0}", { value0: String(doc.room) })}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.unassignedRoomText}>{t("Room unassigned")}</Text>
                                )}
                              </View>
                            </View>
                          </View>

                          <StatusChip
                            status={doc.status}
                            label={
                              doc.status === 'on_break' || doc.status === 'on break'
                                ? t('On Break')
                                : doc.status === 'available' || doc.status === 'active' || doc.status === 'consulting'
                                ? t('Online / Active')
                                : undefined
                            }
                            size="small"
                          />
                        </View>

                        {/* Doctor Capacity & Progress Row */}
                        <View style={styles.doctorProgressContainer}>
                          <View style={styles.doctorProgressHeader}>
                            <Text style={styles.doctorProgressLabel}>{t("Attended Patients")}</Text>
                            <Text style={styles.doctorCapacityText}>
                              <Text style={styles.doctorAttendedNumber}>{attendedCount}</Text>
                              <Text style={styles.doctorTotalCapacity}> / {capacity}</Text>
                              <Text style={styles.doctorCapPercent}> ({docCapPct}%)</Text>
                            </Text>
                          </View>

                          <View style={styles.doctorProgressBarTrack}>
                            <View
                              style={[
                                styles.doctorProgressBarFill,
                                {
                                  width: `${docCapPct}%`,
                                  backgroundColor: isFull ? Colors.warning : Colors.primary,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ── GENERATE & EXPORT DAILY REPORT ACTION ── */}
            <View style={styles.section}>
              <View style={styles.exportCard}>
                <View style={styles.exportCardHeader}>
                  <View style={styles.exportIconBox}>
                    <Ionicons name="document-text" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.exportHeaderTextWrap}>
                    <Text style={styles.exportCardTitle}>{t("Daily Shift Audit Log & Reports")}</Text>
                    <Text style={styles.exportCardSubtitle}>
                      {t("Generate official PDF summary report or export complete CSV audit encounter log.")}</Text>
                  </View>
                </View>

                {/* Action Buttons: Generate PDF + Export CSV */}
                <View style={styles.exportButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.exportButton,
                      styles.pdfExportButton,
                      (exporting || loading) && styles.exportButtonDisabled,
                    ]}
                    onPress={() => handleExportDailyReport('pdf')}
                    disabled={exporting || loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t("Generate and print daily PDF report")}
                  >
                    {exporting && exportingFormat === 'pdf' ? (
                      <View style={styles.exportBtnInner}>
                        <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.exportButtonText}>{t("Generating PDF...")}</Text>
                      </View>
                    ) : (
                      <View style={styles.exportBtnInner}>
                        <Ionicons name="print-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                        <Text style={styles.exportButtonText}>{t("Generate & Print PDF")}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.exportButton,
                      styles.csvExportButton,
                      (exporting || loading) && styles.exportButtonDisabled,
                    ]}
                    onPress={() => handleExportDailyReport('csv')}
                    disabled={exporting || loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t("Export CSV encounter log")}
                  >
                    {exporting && exportingFormat === 'csv' ? (
                      <View style={styles.exportBtnInner}>
                        <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.exportButtonText}>{t("Exporting CSV...")}</Text>
                      </View>
                    ) : (
                      <View style={styles.exportBtnInner}>
                        <Ionicons name="share-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                        <Text style={styles.exportButtonText}>{t("Export CSV Log")}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── CLOSE SHIFT ACTION SECTION ── */}
            <View style={styles.section}>
              <View style={styles.closeShiftCard}>
                <View style={styles.closeShiftHeaderRow}>
                  <View
                    style={[
                      styles.closeShiftIconBox,
                      shiftClosed && { backgroundColor: '#ECFDF5' },
                    ]}
                  >
                    <Ionicons
                      name={shiftClosed ? 'checkmark-circle' : 'power'}
                      size={22}
                      color={shiftClosed ? Colors.success : Colors.danger}
                    />
                  </View>
                  <View style={styles.closeShiftTextWrap}>
                    <View style={styles.closeShiftTitleRow}>
                      <Text style={styles.closeShiftTitle}>{t("End Shift")}</Text>
                      {shiftClosed && (
                        <View style={styles.shiftClosedBadge}>
                          <Ionicons name="lock-closed" size={11} color={Colors.success} style={{ marginRight: 3 }} />
                          <Text style={styles.shiftClosedBadgeText}>{t("Shift closed")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.closeShiftSubtitle}>
                      {shiftClosed
                        ? t("Today's summary figures have been locked and archived.")
                        : t("Finalize today's intake and store the shift performance snapshot.")}
                    </Text>
                  </View>
                </View>

                {shiftClosed ? (
                  <View style={styles.shiftClosedSuccessState}>
                    <Ionicons name="checkmark-done-circle" size={20} color={Colors.success} style={{ marginRight: 8 }} />
                    <Text style={styles.shiftClosedSuccessText}>{t("Shift closed")}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.closeShiftButton,
                      (closingShift || loading) && styles.closeShiftButtonDisabled,
                    ]}
                    onPress={handleCloseShiftPress}
                    disabled={closingShift || loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t("Close Counter 01 Shift")}
                  >
                    {closingShift ? (
                      <View style={styles.btnInnerRow}>
                        <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.closeShiftButtonText}>{t("Closing Shift...")}</Text>
                      </View>
                    ) : (
                      <View style={styles.btnInnerRow}>
                        <Ionicons name="power-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.closeShiftButtonText}>{t("Close Counter 01 Shift")}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── TOAST NOTIFICATION ── */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D0E8ED',
    marginHorizontal: 6,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#D0E8ED',
    fontWeight: '600',
  },
  refreshIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rotatingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  stateContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 4,
  },
  statCardWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  /* ── Queue Throughput Card Styles ── */
  throughputCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  throughputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  throughputTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  throughputIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  throughputCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
  },
  throughputCardSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    marginTop: 1,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroThroughputBox: {
    backgroundColor: '#F8FCFD',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2F0F3',
  },
  heroThroughputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  heroThroughputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroThroughputSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  heroThroughputValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroThroughputPercent: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroGoalTarget: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
  },
  heroProgressBarTrack: {
    height: 12,
    backgroundColor: '#E2EEF1',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  heroProgressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  goalMarkerLine: {
    position: 'absolute',
    left: '95%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.primary,
    zIndex: 2,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scaleText: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500',
  },
  scaleGoalText: {
    fontSize: 11,
    color: Colors.textMedium,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 16,
  },
  breakdownHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 12,
  },
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {
    marginBottom: 2,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMedium,
  },
  breakdownCount: {
    fontWeight: '700',
    color: Colors.textDark,
  },
  breakdownBarTrack: {
    height: 8,
    backgroundColor: '#F1F7F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  /* ── Doctor Schedules & Roster Styles ── */
  emptyDoctorCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyDoctorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F7F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyDoctorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  emptyDoctorSubtitle: {
    fontSize: 13,
    color: Colors.textMedium,
    textAlign: 'center',
  },
  doctorsList: {
    gap: 12,
    marginTop: 4,
  },
  doctorCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.6,
        shadowRadius: 3,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  doctorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  doctorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  doctorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorNameWrap: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  doctorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roomTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  unassignedRoomText: {
    fontSize: 11,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  doctorProgressContainer: {
    backgroundColor: '#F8FCFD',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8F4F6',
  },
  doctorProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  doctorProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  doctorCapacityText: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  doctorAttendedNumber: {
    fontWeight: '800',
    color: Colors.textDark,
    fontSize: 13,
  },
  doctorTotalCapacity: {
    fontWeight: '600',
    color: Colors.textMedium,
    fontSize: 13,
  },
  doctorCapPercent: {
    fontWeight: '600',
    color: Colors.textLight,
    fontSize: 11,
  },
  doctorProgressBarTrack: {
    height: 8,
    backgroundColor: '#E2EEF1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  doctorProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  /* ── Export Daily Report Styles ── */
  exportCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  exportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F4F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exportHeaderTextWrap: {
    flex: 1,
  },
  exportCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 2,
  },
  exportCardSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    lineHeight: 16,
  },
  exportButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  exportButtonDisabled: {
    opacity: 0.65,
  },
  exportBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  pdfExportButton: {
    flex: 1,
    backgroundColor: '#006666',
  },
  csvExportButton: {
    flex: 1,
    backgroundColor: '#0284C7',
  },
  /* ── Close Shift Card Styles ── */
  closeShiftCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  closeShiftHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeShiftIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeShiftTextWrap: {
    flex: 1,
  },
  closeShiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  closeShiftTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
  },
  shiftClosedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  shiftClosedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  closeShiftSubtitle: {
    fontSize: 12,
    color: Colors.textMedium,
    lineHeight: 16,
  },
  shiftClosedSuccessState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  shiftClosedSuccessText: {
    color: '#065F46',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closeShiftButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  closeShiftButtonDisabled: {
    opacity: 0.65,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeShiftButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default ReportsScreen;
