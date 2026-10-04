import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { API_URL } from '../../config';

export default function ManageStaffScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const roles = ['All', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Other'];

  // Fetch staff when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchStaff();
    }, [])
  );

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/staff`);
      if (response.ok) {
        const data = await response.json();
        setStaff(data);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (member: any) => {
    try {
      const response = await fetch(`${API_URL}/staff/${member._id}/toggle-status`, {
        method: 'PATCH',
      });
      if (response.ok) {
        fetchStaff();
        setShowManageModal(false);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Could not update status');
    }
  };

  const handleDelete = (member: any) => {
    Alert.alert(
      'Delete Staff',
      `Are you sure you want to remove ${member.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/staff/${member._id}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                fetchStaff();
                setShowManageModal(false);
              }
            } catch (error) {
              console.error('Error deleting staff:', error);
              Alert.alert('Error', 'Could not delete staff');
            }
          }
        }
      ]
    );
  };

  const filteredStaff = activeFilter === 'All' 
    ? staff 
    : staff.filter(s => s.role === activeFilter);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Staff Management</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.topSection}>
            <Text style={styles.sectionTitle}>Hospital Staff</Text>
            <Text style={styles.sectionSubtitle}>View and manage all registered employees.</Text>

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/(moh)/add-staff')}
            >
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>Register New Staff</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, role or employee ID..."
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContainer}
          >
            {roles.map((type, index) => {
              const count = type === 'All' ? staff.length : staff.filter(s => s.role === type).length;
              const label = type === 'All' ? `All Staff (${count})` : `${type} (${count})`;
              const isActive = activeFilter === type;

              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveFilter(type)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.listContainer}>
            <Text style={styles.listHeader}>
              Registered Staff ({filteredStaff.length})
            </Text>
            
            {loading ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>Loading staff...</Text>
            ) : filteredStaff.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMedium }}>No staff registered yet.</Text>
            ) : (
              filteredStaff.map((member) => (
                <TouchableOpacity 
                  key={member._id} 
                  style={styles.staffCard}
                  onPress={() => {
                    setSelectedStaff(member);
                    setShowDetailsModal(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.staffIconContainer}>
                      <Text style={styles.staffIcon}>{member.role === 'Doctor' ? '👨‍⚕️' : '👩‍💼'}</Text>
                    </View>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName} numberOfLines={1}>{member.fullName}</Text>
                      <Text style={styles.staffDetails}>{member.role} • {member.hospitalName || 'No Hospital'}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      member.status === 'Active' ? styles.statusActive : styles.statusMaintenance
                    ]}>
                      <Text style={[
                        styles.statusText,
                        member.status === 'Active' ? styles.statusTextActive : styles.statusTextMaintenance
                      ]}>{member.status || 'Active'}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsBtn}
                      onPress={() => {
                        setSelectedStaff(member);
                        setShowManageModal(true);
                      }}
                    >
                      <Text style={styles.moreOptionsText}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.codeContainer}>
                      <Text style={styles.codeLabel}>Emp ID:</Text>
                      <Text style={styles.codeValue}>{member.employeeNo}</Text>
                    </View>
                    <View style={styles.deptBadge}>
                      <Text style={styles.deptBadgeText}>
                        {member.department || 'N/A'}
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
                <Text style={styles.actionSheetTitle}>{selectedStaff?.fullName}</Text>
                <Text style={styles.actionSheetSubtitle}>{selectedStaff?.employeeNo} • {selectedStaff?.role}</Text>
              </View>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => {
                setShowManageModal(false);
                router.push({
                  pathname: '/(moh)/add-staff',
                  params: { editStaffData: JSON.stringify(selectedStaff) }
                });
              }}>
                <Text style={styles.actionOptionText}>✏️ Edit Details</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOption} onPress={() => handleToggleStatus(selectedStaff)}>
                <Text style={styles.actionOptionText}>
                  {selectedStaff?.status === 'Active' ? '⏸ Deactivate' : '▶️ Activate'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionOptionDelete} onPress={() => handleDelete(selectedStaff)}>
                <Text style={styles.actionOptionTextDelete}>🗑 Delete Staff</Text>
              </TouchableOpacity>
              
              <View style={styles.actionSheetDivider} />
              
              <TouchableOpacity style={styles.actionOptionCancel} onPress={() => setShowManageModal(false)}>
                <Text style={styles.actionOptionTextCancel}>Cancel</Text>
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
                <Text style={styles.actionSheetTitle}>{selectedStaff?.fullName}</Text>
                <Text style={styles.actionSheetSubtitle}>{selectedStaff?.role} • {selectedStaff?.hospitalName}</Text>
              </View>

              <ScrollView style={{ padding: 20, maxHeight: 400 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>Basic Information</Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>NIC: <Text style={{ color: Colors.textDark }}>{selectedStaff?.nic}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Email: <Text style={{ color: Colors.textDark }}>{selectedStaff?.email}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Mobile: <Text style={{ color: Colors.textDark }}>{selectedStaff?.mobile}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 15 }}>Gender: <Text style={{ color: Colors.textDark }}>{selectedStaff?.gender}</Text></Text>
                
                <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>Employment Information</Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Employee ID: <Text style={{ color: Colors.textDark }}>{selectedStaff?.employeeNo}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Department: <Text style={{ color: Colors.textDark }}>{selectedStaff?.department || 'N/A'}</Text></Text>
                <Text style={{ color: Colors.textMedium, marginBottom: 15 }}>Status: <Text style={{ color: Colors.textDark }}>{selectedStaff?.status}</Text></Text>

                {selectedStaff?.role === 'Doctor' && (
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>Doctor Information</Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Med Reg No: <Text style={{ color: Colors.textDark }}>{selectedStaff?.medRegNo}</Text></Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Specialization: <Text style={{ color: Colors.textDark }}>{selectedStaff?.specialization}</Text></Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 15 }}>Qualification: <Text style={{ color: Colors.textDark }}>{selectedStaff?.doctorQualification}</Text></Text>
                  </View>
                )}

                {selectedStaff?.role === 'Nurse' && (
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: Colors.textDark }}>Nurse Information</Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Nurse Reg No: <Text style={{ color: Colors.textDark }}>{selectedStaff?.nurseRegNo}</Text></Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 4 }}>Qualification: <Text style={{ color: Colors.textDark }}>{selectedStaff?.nurseQualification}</Text></Text>
                    <Text style={{ color: Colors.textMedium, marginBottom: 15 }}>Ward: <Text style={{ color: Colors.textDark }}>{selectedStaff?.ward}</Text></Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.actionSheetDivider} />
              <TouchableOpacity style={styles.actionOptionCancel} onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.actionOptionTextCancel}>Close</Text>
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
    paddingBottom: 25,
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
    marginBottom: 20,
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonIcon: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '600',
    marginRight: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
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
  staffCard: {
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
  staffIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  staffIcon: {
    fontSize: 24,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  staffDetails: {
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
  statusMaintenance: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#2E7D32',
  },
  statusTextMaintenance: {
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
