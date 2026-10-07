import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React, { useState } from 'react';
import { View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function ManagePatientsScreen() {
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPatients();
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const [activeFilter, setActiveFilter] = useState('All');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filters = ['All', 'Male', 'Female'];

  useFocusEffect(
    React.useCallback(() => {
      fetchPatients();
    }, [])
  );

  const fetchPatients = async () => {
    setLoading(true);
    try {
      // Assuming a generic endpoint for fetching patients
      const response = await fetch(`${API_URL}/patients`);
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      } else {
        // Fallback dummy data for UI testing if endpoint doesn't exist yet
        setPatients([
          {
            _id: '1',
            fullName: 'Kasun Perera',
            nic: '199012345678',
            mobile: '0711234567',
            gender: 'Male',
            bloodGroup: 'O+',
            status: 'Active',
            patientNo: 'PAT-001',
          },
          {
            _id: '2',
            fullName: 'Nimali Silva',
            nic: '198512345678',
            mobile: '0771234567',
            gender: 'Female',
            bloodGroup: 'A+',
            status: 'Active',
            patientNo: 'PAT-002',
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (patient: any) => {
    try {
      const response = await fetch(`${API_URL}/patients/${patient._id}/toggle-status`, {
        method: 'PATCH',
      });
      if (response.ok) {
        fetchPatients();
        setShowManageModal(false);
      } else {
        Alert.alert(t('Notice'), t('Endpoint might not be ready yet.'));
        setShowManageModal(false);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert(t('Error'), t('Could not update status'));
    }
  };

  const handleDelete = (patient: any) => {
    Alert.alert(
      t('Delete Patient'),
      t("Are you sure you want to remove {value0}?", { value0: String(patient.fullName) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/patients/${patient._id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                fetchPatients();
                setShowManageModal(false);
              } else {
                Alert.alert(t('Notice'), t('Endpoint might not be ready yet.'));
                setShowManageModal(false);
              }
            } catch (error) {
              console.error('Error deleting patient:', error);
              Alert.alert(t('Error'), t('Could not delete patient'));
            }
          }
        }
      ]
    );
  };

  const filteredPatients = activeFilter === 'All' 
    ? patients 
    : patients.filter(p => p.gender === activeFilter);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("Patient Management")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          
          <View style={styles.topSection}>
            <Text style={styles.sectionTitle}>{t("Registered Patients")}</Text>
            <Text style={styles.sectionSubtitle}>{t("View and manage all registered patients across the system.")}</Text>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t("Search by name, NIC or Patient ID...")}
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContainer}
          >
            {filters.map((type, index) => {
              const count = type === 'All' ? patients.length : patients.filter(p => p.gender === type).length;
              const label = type === 'All' ? t('All Patients ({count})', { count }) : `${t(type)} (${count})`;
              const isActive = activeFilter === type;

              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveFilter(type)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {t(label ?? '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.listContainer}>
            <Text style={styles.listHeader}>
              {t("Patient Directory (")}{filteredPatients.length})
            </Text>
            
            {loading ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>{t("Loading patients...")}</Text>
            ) : filteredPatients.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>{t("No patients found.")}</Text>
            ) : (
              filteredPatients.map((patient) => (
                <TouchableOpacity 
                  key={patient._id} 
                  style={styles.patientCard}
                  onPress={() => {
                    setSelectedPatient(patient);
                    setShowDetailsModal(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.patientIconContainer}>
                      <Text style={styles.patientIcon}>{patient.gender === 'Female' ? '👩' : '👨'}</Text>
                    </View>
                    <View style={styles.patientInfo}>
                      <Text style={styles.patientName} numberOfLines={1}>{patient.fullName}</Text>
                      <Text style={styles.patientDetails}>{t(patient.gender ?? '')} • {patient.bloodGroup || t('Blood Group N/A')}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      patient.status === 'Active' ? styles.statusActive : styles.statusInactive
                    ]}>
                      <Text style={[
                        styles.statusText,
                        patient.status === 'Active' ? styles.statusTextActive : styles.statusTextInactive
                      ]}>{t(patient.status ?? '') || t('Active')}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsBtn}
                      onPress={() => {
                        setSelectedPatient(patient);
                        setShowManageModal(true);
                      }}
                    >
                      <Text style={styles.moreOptionsText}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.codeContainer}>
                      <Text style={styles.codeLabel}>{t("Patient ID:")}</Text>
                      <Text style={styles.codeValue}>{patient.patientNo || t('N/A')}</Text>
                    </View>
                    <View style={styles.contactBadge}>
                      <Text style={styles.contactBadgeText}>
                        {patient.mobile || t('No Contact')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

        </ScrollView>
        
        {/* Centered Action Popup Modal */}
        <Modal
          visible={showManageModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowManageModal(false)}
        >
          <TouchableOpacity 
            style={styles.actionSheetOverlay} 
            activeOpacity={1} 
            onPress={() => setShowManageModal(false)}
          >
            <View style={styles.actionSheetContent}>
              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetTitle}>{selectedPatient?.fullName}</Text>
                <Text style={styles.actionSheetSubtitle}>{selectedPatient?.patientNo} • {selectedPatient?.nic}</Text>
              </View>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => {
                setShowManageModal(false);
                router.push({
                  pathname: '/(moh)/edit-patient',
                  params: { editPatientData: JSON.stringify(selectedPatient) }
                });
              }}>
                <Text style={styles.actionOptionText}>{t("✏️ Edit Details")}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => handleToggleStatus(selectedPatient)}>
                <Text style={styles.actionOptionText}>
                  {selectedPatient?.status === 'Active' ? t('⏸ Deactivate') : t('▶️ Activate')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOptionDelete} onPress={() => handleDelete(selectedPatient)}>
                <Text style={styles.actionOptionTextDelete}>{t("🗑 Delete Patient")}</Text>
              </TouchableOpacity>
              
              <View style={styles.actionSheetDivider} />
              
              <TouchableOpacity style={styles.actionOptionCancel} onPress={() => setShowManageModal(false)}>
                <Text style={styles.actionOptionTextCancel}>{t("Cancel")}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Centered Details Popup Modal */}
        <Modal
          visible={showDetailsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <TouchableOpacity 
            style={styles.actionSheetOverlay} 
            activeOpacity={1} 
            onPress={() => setShowDetailsModal(false)}
          >
            <View style={[styles.actionSheetContent, { width: '85%' }]}>
              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetTitle}>{selectedPatient?.fullName}</Text>
                <Text style={styles.actionSheetSubtitle}>{t("Patient ID:")}{' '}{selectedPatient?.patientNo}</Text>
              </View>

              <ScrollView style={{ padding: 20, maxHeight: 400 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>{t("Basic Information")}</Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>{t("NIC:")}{' '}<Text style={{ color: Colors.textDark }}>{selectedPatient?.nic}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>{t("Mobile:")}{' '}<Text style={{ color: Colors.textDark }}>{selectedPatient?.mobile}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>{t("Gender:")}{' '}<Text style={{ color: Colors.textDark }}>{t(selectedPatient?.gender ?? '')}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 15 }}>{t("Blood Group:")}{' '}<Text style={{ color: Colors.textDark }}>{selectedPatient?.bloodGroup || t('N/A')}</Text></Text>
                
                <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>{t("System Information")}</Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>{t("Status:")}{' '}<Text style={{ color: Colors.textDark }}>{t(selectedPatient?.status ?? '')}</Text></Text>
              </ScrollView>

              <View style={styles.actionSheetDivider} />
              <TouchableOpacity style={styles.actionOptionCancel} onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.actionOptionTextCancel}>{t("Close")}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.textDark,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: Colors.textMedium,
    marginBottom: 10,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 20,
    height: 50,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textDark,
  },
  filterContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 15,
  },
  patientCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  patientIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  patientIcon: {
    fontSize: 24,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 13,
    color: Colors.textMedium,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#2E7D32',
  },
  statusTextInactive: {
    color: '#C62828',
  },
  moreOptionsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  moreOptionsText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMedium,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: Colors.textMedium,
    marginRight: 4,
  },
  codeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  contactBadge: {
    backgroundColor: '#f0f9fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contactBadgeText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheetContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '85%',
  },
  actionSheetHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 15,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: Colors.textMedium,
  },
  actionOption: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionOptionText: {
    fontSize: 16,
    color: Colors.textDark,
    fontWeight: '500',
  },
  actionOptionDelete: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionOptionTextDelete: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '500',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },
  actionOptionCancel: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionOptionTextCancel: {
    fontSize: 16,
    color: Colors.textMedium,
    fontWeight: '600',
  },
});
