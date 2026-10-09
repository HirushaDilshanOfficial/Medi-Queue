import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { MOHBottomNav } from '../../components/moh/MOHBottomNav';
import { API_URL } from '../../config';
import Toast from 'react-native-toast-message';

export default function ManageHospitalsScreen() {
  const { clinicFilter } = useLocalSearchParams();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchHospitals();
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [hospitals, setHospitals] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedHospital, setSelectedHospital] = React.useState<any>(null);
  const [showManageModal, setShowManageModal] = React.useState(false);

  // Fetch hospitals when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchHospitals();
    }, [])
  );

  const fetchHospitals = async () => {
    try {
      const response = await fetch(`${API_URL}/hospitals`);
      const data = await response.json();
      if (response.ok) {
        setHospitals(data);
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (hospital: any) => {
    try {
      const response = await fetch(`${API_URL}/hospitals/${hospital._id}/toggle-status`, {
        method: 'PATCH',
      });
      if (response.ok) {
        fetchHospitals();
        setShowManageModal(false);
        Toast.show({
          type: 'success',
          text1: t('Status Updated'),
          text2: t('Hospital status changed successfully.'),
          position: 'top',
          topOffset: 60,
        });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      Toast.show({
        type: 'error',
        text1: t('Error'),
        text2: t('Could not update status'),
        position: 'top',
        topOffset: 60,
      });
    }
  };

  const handleDelete = (hospital: any) => {
    Alert.alert(
      t('Delete Hospital'),
      t("Are you sure you want to delete {value0}?", { value0: String(hospital.name) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/hospitals/${hospital._id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                fetchHospitals();
                setShowManageModal(false);
                Toast.show({
                  type: 'success',
                  text1: t('Hospital Deleted'),
                  text2: t('The hospital has been deleted from the system.'),
                  position: 'top',
                  topOffset: 60,
                });
              }
            } catch (error) {
              console.error('Error deleting hospital:', error);
              Toast.show({
                type: 'error',
                text1: t('Error'),
                text2: t('Could not delete hospital'),
                position: 'top',
                topOffset: 60,
              });
            }
          }
        }
      ]
    );
  };

  const filteredHospitals = hospitals.filter(h => {
    const matchesFilter = activeFilter === 'All' || h.type === activeFilter;
    
    // Clinic filter logic (checks if any department partially matches the clinicFilter)
    let matchesClinic = true;
    if (clinicFilter) {
      matchesClinic = h.departments && h.departments.some((dept: string) => 
        dept.toLowerCase().includes((clinicFilter as string).toLowerCase())
      );
    }

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      h.name?.toLowerCase().includes(searchLower) || 
      h.code?.toLowerCase().includes(searchLower) ||
      h.location?.toLowerCase().includes(searchLower);
      
    return matchesFilter && matchesSearch && matchesClinic;
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("Manage Hospitals")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            
            <View style={styles.topSection}>
            <Text style={styles.sectionTitle}>{t("Hospital Network")}</Text>
            <Text style={styles.sectionSubtitle}>{t("View and manage all registered healthcare facilities.")}</Text>

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/(moh)/add-hospital')}
            >
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>{t("Add New Hospital")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={Colors.textMedium} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("Search by name, code or district...")}
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {clinicFilter && (
            <View style={{ paddingHorizontal: 20, marginBottom: 15, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: Colors.textMedium, marginRight: 10 }}>
                {t("Filtering by Clinic:")} <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{clinicFilter}</Text>
              </Text>
              <TouchableOpacity onPress={() => router.setParams({ clinicFilter: '' })}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContainer}
          >
            {[
              'All',
              'National Hospital',
              'Teaching Hospital',
              'Provincial General',
              'District General',
              'Base Hospital',
              'Divisional Hospital'
            ].map((type, index) => {
              const count = type === 'All' ? hospitals.length : hospitals.filter(h => h.type === type).length;
              const label = type === 'All' ? t('All Hospitals ({count})', { count }) : `${t(type)} (${count})`;
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
              {t("Registered Facilities (")}{filteredHospitals.length})
            </Text>
            
            {loading ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>{t("Loading hospitals...")}</Text>
            ) : filteredHospitals.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>{t("No hospitals found.")}</Text>
            ) : (
              filteredHospitals.map((hospital) => (
                <TouchableOpacity 
                  key={hospital._id} 
                  style={styles.hospitalCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(moh)/hospital-dashboard?id=${hospital._id}&name=${encodeURIComponent(hospital.name)}`)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.hospitalIconContainer}>
                      <Text style={styles.hospitalIcon}>🏥</Text>
                    </View>

                    <View style={styles.hospitalInfo}>
                      <Text style={styles.hospitalName} numberOfLines={1}>{hospital.name}</Text>
                      <Text style={styles.hospitalDetails}>{t(hospital.type)} • {hospital.location}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      hospital.status === 'Active' ? styles.statusActive : styles.statusMaintenance
                    ]}>
                      <Text style={[
                        styles.statusText,
                        hospital.status === 'Active' ? styles.statusTextActive : styles.statusTextMaintenance
                      ]}>{t(hospital.status ?? '')}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsBtn}
                      onPress={() => {
                        setSelectedHospital(hospital);
                        setShowManageModal(true);
                      }}
                    >
                      <Text style={styles.moreOptionsText}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.codeContainer}>
                      <Text style={styles.codeLabel}>{t("Code:")}</Text>
                      <Text style={styles.codeValue}>{hospital.code}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.clinicButton}
                        onPress={() => router.push(`/(moh)/manage-clinics?hospitalId=${hospital._id}&hospitalName=${encodeURIComponent(hospital.name)}`)}
                      >
                        <Text style={styles.clinicButtonText}>{t("Configure clinics")}</Text>
                      </TouchableOpacity>
                      <View style={styles.deptBadge}>
                        <Text style={styles.deptBadgeText}>
                          {hospital.departments?.length || 0} {t("Departments")}
                        </Text>
                      </View>
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
                <Text style={styles.actionSheetTitle}>{selectedHospital?.name}</Text>
                <Text style={styles.actionSheetSubtitle}>{selectedHospital?.code}</Text>
              </View>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => {
                setShowManageModal(false);
                router.push({
                  pathname: '/(moh)/add-hospital',
                  params: { editHospitalData: JSON.stringify(selectedHospital) }
                });
              }}>
                <Text style={styles.actionOptionText}>{t("✏️ Edit Hospital Details")}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => handleToggleStatus(selectedHospital)}>
                <Text style={styles.actionOptionText}>
                  {selectedHospital?.status === 'Active' ? t('⏸ Deactivate Hospital') : t('▶️ Activate Hospital')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOptionDelete} onPress={() => handleDelete(selectedHospital)}>
                <Text style={styles.actionOptionTextDelete}>{t("🗑 Delete Hospital")}</Text>
              </TouchableOpacity>
              
              <View style={styles.actionSheetDivider} />
              
              <TouchableOpacity style={styles.actionOptionCancel} onPress={() => setShowManageModal(false)}>
                <Text style={styles.actionOptionTextCancel}>{t("Cancel")}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <MOHBottomNav activeRoute="hospitals" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: Colors.primaryDark,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: Colors.white,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  topSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textMedium,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textDark,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingRight: 20, // Space at the end of scroll
  },
  filterChip: {
    backgroundColor: '#eef6f7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
  },
  filterText: {
    color: Colors.textMedium,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMedium,
    marginBottom: 16,
  },
  hospitalCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  clinicButton: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e8f5f6',
  },
  clinicButtonText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  hospitalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hospitalIcon: {
    fontSize: 20,
  },
  hospitalInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  hospitalDetails: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusActive: {
    backgroundColor: '#e2f5ec',
  },
  statusMaintenance: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusTextMaintenance: {
    color: '#856404',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginRight: 4,
  },
  codeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },
  moreOptionsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 4,
  },
  moreOptionsText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMedium,
  },
  deptBadge: {
    backgroundColor: '#f0f9fa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deptBadgeText: {
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
