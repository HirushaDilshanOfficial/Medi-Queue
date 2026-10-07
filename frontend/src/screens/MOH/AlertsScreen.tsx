import React, { useState, useEffect } from 'react';
import { View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';
import { Ionicons } from '@expo/vector-icons';

export default function AlertsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAlerts();
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const [activeFilter, setActiveFilter] = useState('All Alerts');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/alerts`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/alerts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Acknowledged' })
      });
      if (response.ok) {
        Alert.alert('Success', 'Alert acknowledged.');
        fetchAlerts(); // refresh
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleDispatch = (hospitalName: string) => {
    Alert.alert('Alert Dispatched 🚀', `Instructions successfully sent to the Receptionist at ${hospitalName}.`);
  };

  const filteredAlerts = alerts.filter(alert => 
    activeFilter === 'All Alerts' || alert.category === activeFilter
  );

  const filters = [
    { label: 'All Alerts', count: alerts.length },
    { label: 'Overcrowding', count: alerts.filter(a => a.category === 'Overcrowding').length },
    { label: 'Doctor Shortage', count: alerts.filter(a => a.category === 'Doctor Shortage').length },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: Colors.white }} />
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header Profile Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          <View style={styles.profileIcon}>
            <Ionicons name="business" size={24} color={Colors.primary} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerTitle}>MOH Executive</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>National OPD Network • Alerts</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionIcon}>
            <Ionicons name="notifications" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileImagePlaceholder}>
            <Ionicons name="person" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerHeader}>
            <View style={styles.bannerBadge}>
              <View style={styles.bannerBadgeDot} />
              <Text style={styles.bannerBadgeText}>Automated Sensor Grid</Text>
            </View>
            <Text style={styles.bannerTime}>Refreshed: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
          </View>
          <Text style={styles.bannerTitle}>National Queue Early Warning</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Ionicons name="time" size={18} color={Colors.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.bannerSubtitle}>
              {alerts.length} active bottlenecks requiring executive action
            </Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
          {filters.map((filter, index) => {
            const isActive = activeFilter === filter.label;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter.label)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {filter.label} {filter.count > 0 && <Text style={styles.filterCount}>{filter.count}</Text>}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Alerts List */}
        <View style={styles.alertsContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : filteredAlerts.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>No active alerts right now.</Text>
          ) : (
            filteredAlerts.map(alert => {
              // Determine styles based on priority
              let priorityColor = Colors.primary;
              let bgColor = '#E6F4F1';
              let icon = 'trending-up';
              
              if (alert.priority === 'HIGH PRIORITY') {
                priorityColor = '#FF3B30';
                bgColor = '#FFEBEB';
                icon = 'business';
              } else if (alert.priority === 'STAFFING NOTICE') {
                priorityColor = '#34C759';
                bgColor = '#E8F5E9';
                icon = 'medkit';
              }

              return (
                <View key={alert._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardPriorityRow}>
                      <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                      <Text style={[styles.priorityText, { color: priorityColor }]}>{alert.priority}</Text>
                      <Text style={styles.prioritySeparator}>•</Text>
                      <Text style={styles.cardLocation}>{alert.location}</Text>
                    </View>
                    <View style={[styles.cardIconBox, { backgroundColor: bgColor }]}>
                      <Ionicons name={icon as any} size={24} color={priorityColor} />
                    </View>
                  </View>
                  
                  <Text style={styles.hospitalName}>{alert.hospitalName}</Text>
                  
                  <View style={[styles.infoBox, alert.priority === 'HIGH PRIORITY' ? {} : { backgroundColor: '#F0F8FF' }]}>
                    <Text style={styles.infoBoxTitle}>{alert.title}</Text>
                    <Text style={styles.infoBoxText}>{alert.description}</Text>
                  </View>
                  
                  {alert.metrics && Object.keys(alert.metrics).length > 0 && (
                    <View style={[styles.metricsRow, alert.priority !== 'HIGH PRIORITY' && { backgroundColor: '#F0F8FF', padding: 12, borderRadius: 8 }]}>
                      {Object.keys(alert.metrics).map((key, index) => (
                        <View key={index} style={alert.priority === 'HIGH PRIORITY' ? styles.metricBox : { flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          {alert.priority === 'HIGH PRIORITY' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name={index === 0 ? 'people' : 'medical'} size={18} color={Colors.textDark} style={{ marginRight: 6 }} />
                              <View>
                                <Text style={styles.metricLabel}>{key}</Text>
                                <Text style={styles.metricValue}>{alert.metrics[key]}</Text>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Ionicons name="hourglass-outline" size={16} color={Colors.textMedium} style={{ marginRight: 8 }} />
                              <Text style={{ color: Colors.textMedium, fontSize: 13, flex: 1 }}>{key}</Text>
                              <Text style={{ color: Colors.primaryDark, fontWeight: 'bold', fontSize: 15 }}>{alert.metrics[key]}</Text>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {alert.aiRecommendation && (
                    <View style={styles.aiRecommendationBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Ionicons name="sparkles" size={18} color={Colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.aiLabel}>AI RECOMMENDED INTERVENTION</Text>
                          <Text style={styles.aiText}>{alert.aiRecommendation}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  
                  <View style={[styles.cardActionsRow, { marginTop: 15 }]}>
                    <TouchableOpacity 
                      style={[styles.secondaryButton, { flex: 1, backgroundColor: bgColor }]}
                      onPress={() => {
                        setSelectedAlert(alert);
                        setShowQueueModal(true);
                      }}
                    >
                      <Text style={[styles.secondaryButtonText, { color: Colors.primaryDark }]}>
                        <Ionicons name="eye" size={16} color={Colors.primaryDark} style={{ marginRight: 4 }} /> Review Live Queue
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.cardActionsRow, { marginTop: 10 }]}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => handleAcknowledge(alert._id)}>
                      <Text style={styles.secondaryButtonText}><Ionicons name="checkmark" size={16} color={Colors.textDark} /> Acknowledge</Text>
                    </TouchableOpacity>
                    
                    {alert.priority === 'HIGH PRIORITY' && (
                      <TouchableOpacity style={styles.primaryButton} onPress={() => handleDispatch(alert.hospitalName)}>
                        <Text style={styles.primaryButtonText}><Ionicons name="send" size={16} color={Colors.white} /> Dispatch Alert</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Settings / Threshold Engine Link */}
          <TouchableOpacity style={styles.settingsBox}>
            <View style={styles.settingsIconBox}>
              <Ionicons name="settings" size={24} color={Colors.textDark} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={styles.settingsTitle}>Sensor Threshold Engine</Text>
              <Text style={styles.settingsDesc}>Alert triggers at &gt;35 min wait or &gt;25 patient</Text>
            </View>
            <Text style={{ color: Colors.textLight }}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Queue Details Modal */}
      <Modal
        visible={showQueueModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQueueModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowQueueModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live Queue Details</Text>
              <Text style={styles.modalSubtitle}>{selectedAlert?.hospitalName}</Text>
            </View>
            
            <View style={{ padding: 20 }}>
              <View style={styles.queueInfoCard}>
                <Text style={styles.queueInfoLabel}>Current Total Patients in Queue</Text>
                <Text style={styles.queueInfoValue}>
                  {selectedAlert?.metrics?.['Active Queue'] || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.queueInfoCard}>
                <Text style={styles.queueInfoLabel}>Available Doctors</Text>
                <Text style={styles.queueInfoValue}>
                  {selectedAlert?.metrics?.['Physician Ratio'] ? selectedAlert.metrics['Physician Ratio'].split('(')[1].replace(')', '') : 'N/A'}
                </Text>
              </View>

              <View style={styles.queueInfoCard}>
                <Text style={styles.queueInfoLabel}>Estimated Wait Time (Last Patient)</Text>
                <Text style={[styles.queueInfoValue, { color: '#FF3B30' }]}>
                  {selectedAlert?.title.includes('Orthopedic') ? '54 mins' : '22 mins'}
                </Text>
              </View>
              
              <Text style={{ fontSize: 13, color: Colors.textMedium, marginTop: 10, textAlign: 'center' }}>
                (Live data fetched directly from the hospital sensor grid)
              </Text>
            </View>

            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowQueueModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white },
  backButton: { paddingRight: 15 },
  backButtonText: { fontSize: 24, color: Colors.textDark },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  profileIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  profileIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textDark, marginRight: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F4F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginRight: 4 },
  liveText: { fontSize: 10, color: Colors.primaryDark, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, color: Colors.textMedium, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { marginRight: 12, padding: 4 },
  profileImagePlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flex: 1 },
  bannerContainer: { backgroundColor: Colors.primary, margin: 16, borderRadius: 16, padding: 20 },
  bannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  bannerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bannerBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white, marginRight: 6 },
  bannerBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '500' },
  bannerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  bannerTitle: { color: Colors.white, fontSize: 22, fontWeight: 'bold' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, flex: 1, lineHeight: 18 },
  filtersScroll: { marginBottom: 16 },
  filtersContainer: { paddingHorizontal: 16, gap: 10 },
  filterChip: { backgroundColor: '#EAEAEA', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterChipActive: { backgroundColor: Colors.primaryDark },
  filterText: { color: Colors.textMedium, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  filterCount: { opacity: 0.8 },
  alertsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardPriorityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  priorityText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  prioritySeparator: { color: Colors.textLight, marginHorizontal: 6 },
  cardLocation: { fontSize: 11, color: Colors.textMedium },
  cardIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFEBEB', alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 16 },
  hospitalName: { fontSize: 18, fontWeight: 'bold', color: Colors.textDark, marginBottom: 12 },
  infoBox: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 12 },
  infoBoxTitle: { fontSize: 13, fontWeight: '600', color: Colors.textDark, marginBottom: 4 },
  infoBoxText: { fontSize: 12, color: Colors.textMedium, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricBox: { flex: 1, backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8 },
  metricLabel: { fontSize: 10, color: Colors.textMedium },
  metricValue: { fontSize: 13, fontWeight: 'bold', color: Colors.textDark, marginTop: 2 },
  aiRecommendationBox: { backgroundColor: '#E0F7FA', padding: 12, borderRadius: 8, marginBottom: 16 },
  aiLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 4 },
  aiText: { fontSize: 12, color: Colors.primaryDark, lineHeight: 18 },
  cardActionsRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, backgroundColor: '#F0F0F0', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondaryButtonText: { color: Colors.textDark, fontSize: 13, fontWeight: '600' },
  primaryButton: { flex: 1.2, backgroundColor: Colors.primaryDark, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  settingsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F4F1', padding: 16, borderRadius: 12 },
  settingsIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  settingsTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.textDark },
  settingsDesc: { fontSize: 11, color: Colors.textMedium, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden' },
  modalHeader: { backgroundColor: '#F8F9FA', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EAEAEA', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textDark },
  modalSubtitle: { fontSize: 13, color: Colors.textMedium, marginTop: 4 },
  queueInfoCard: { backgroundColor: '#F0F8FF', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  queueInfoLabel: { fontSize: 12, color: Colors.textMedium, marginBottom: 4 },
  queueInfoValue: { fontSize: 20, fontWeight: 'bold', color: Colors.primaryDark },
  modalDivider: { height: 1, backgroundColor: '#EAEAEA' },
  modalCloseButton: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#FF3B30' }
});
