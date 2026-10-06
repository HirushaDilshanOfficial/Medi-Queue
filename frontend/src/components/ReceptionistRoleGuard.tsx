import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import useAuth from '../hooks/useAuth';

interface ReceptionistRoleGuardProps {
  children: React.ReactNode;
}

export const ReceptionistRoleGuard: React.FC<ReceptionistRoleGuardProps> = ({ children }) => {
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Verifying authorization...</Text>
      </SafeAreaView>
    );
  }

  const role = (user?.role || '').toLowerCase();
  const isReceptionist = isAuthenticated && (role === 'receptionist' || role === 'admin');

  if (!isReceptionist) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-outline" size={36} color={Colors.danger} />
          </View>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.message}>
            This module is reserved for Receptionist staff only.
          </Text>
          {user?.role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Current Role: {user.role}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={async () => {
              await logout();
              router.replace('/(auth)/login');
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Receptionist Account"
          >
            <Ionicons name="log-in-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Sign In as Receptionist</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMedium,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  roleBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 24,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    minHeight: 48, // >= 44px touch target
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ReceptionistRoleGuard;
