import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useShiftSummary } from '../../hooks';
import {
  StatCard,
  SectionHeader,
  LoadingState,
  ErrorState,
} from '../../components';

export interface ReportsScreenProps {
  navigation?: any;
  onNavigate?: (route: string) => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  navigation,
  onNavigate,
}) => {
  const { data, loading, error, refreshing, refresh } = useShiftSummary();

  // Format today's date
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Calculate completion percentage
  const total = data?.totalRegistered || 0;
  const attended = data?.attended || 0;
  const completedPercent =
    data?.throughputPercent !== undefined
      ? data.throughputPercent
      : total > 0
      ? Math.round((attended / total) * 100)
      : 0;

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
            <Text style={styles.headerTitle}>End-of-Day Summary</Text>
            <View style={styles.headerMetaRow}>
              <View style={styles.headerMetaItem}>
                <Ionicons name="calendar-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
                <Text style={styles.headerSubtitle}>{todayFormatted}</Text>
              </View>
              <View style={styles.metaDot} />
              <View style={styles.headerMetaItem}>
                <Ionicons name="time-outline" size={13} color="#D0E8ED" style={{ marginRight: 4 }} />
                <Text style={styles.headerSubtitle}>Shift: 08:00 - 16:30</Text>
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
          accessibilityLabel="Refresh shift summary"
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
              message="Loading End-of-Day Summary..."
              size="large"
              fullscreen={false}
            />
          </View>
        ) : error && !data ? (
          <View style={styles.stateContainer}>
            <ErrorState
              title="Unable to Load Summary"
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
                title="Shift Performance"
                subtitle="Daily clinic throughput & handling efficiency"
              />

              <View style={styles.statsGrid}>
                {/* 1. Total Registered */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title="Total Registered"
                    value={data?.totalRegistered ?? 0}
                    subtitle="Total patient intake"
                    iconName="people-outline"
                    variant="primary"
                  />
                </View>

                {/* 2. Attended */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title="Attended"
                    value={data?.attended ?? 0}
                    subtitle={`${completedPercent}% completed`}
                    iconName="checkmark-circle-outline"
                    variant="success"
                  />
                </View>

                {/* 3. No-Shows / Cancelled */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title="No-Shows / Cancelled"
                    value={`${data?.noShows ?? 0} / ${data?.cancelled ?? 0}`}
                    subtitle={`${(data?.noShows ?? 0) + (data?.cancelled ?? 0)} missed visits`}
                    iconName="alert-circle-outline"
                    variant="warning"
                  />
                </View>

                {/* 4. Counter Handling avg */}
                <View style={styles.statCardWrapper}>
                  <StatCard
                    title="Counter Handling avg"
                    value={`${data?.avgHandlingMinutes ?? 0} mins`}
                    subtitle="Average consultation time"
                    iconName="time-outline"
                    variant="default"
                  />
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  bottomSpacer: {
    height: 32,
  },
});

export default ReportsScreen;
