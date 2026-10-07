import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { sendPatientOtp, verifyPatientOtp } from '../services/api';

export interface PatientOtpModalProps {
  visible: boolean;
  phone: string;
  patientName: string;
  onClose: () => void;
  onVerified: () => void;
  onSkip?: () => void;
}

export const PatientOtpModal: React.FC<PatientOtpModalProps> = ({
  visible,
  phone,
  patientName,
  onClose,
  onVerified,
  onSkip,
}) => {
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(30);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [smsMessagePreview, setSmsMessagePreview] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<any>(null);

  // Dispatch OTP whenever modal opens
  useEffect(() => {
    if (visible && phone) {
      setOtp('');
      setError(null);
      dispatchOtp();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, phone]);

  const startCountdown = () => {
    setResendCountdown(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const dispatchOtp = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await sendPatientOtp(phone, patientName || 'Patient');
      if (res?.otp) {
        setActiveCode(res.otp);
        setSmsMessagePreview(
          `[Medi-Queue] Hello ${patientName || 'Patient'}, your verification OTP is ${res.otp}. Valid for 10 minutes.`
        );
      }
      startCountdown();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch verification OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const entered = (codeToVerify || otp).trim();
    if (!entered || entered.length < 6) {
      setError('Please enter the full 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await verifyPatientOtp(phone, entered);
      if (res.verified) {
        onVerified();
      } else {
        setError(res.message || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (code: string) => {
    setOtp(code);
    setError(null);
    handleVerify(code);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.shieldIconWrap}>
                <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Patient Phone Verification</Text>
                <Text style={styles.subtitle}>Enter 6-digit SMS code to confirm</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close OTP modal"
            >
              <Ionicons name="close" size={20} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* Target Phone Pill */}
          <View style={styles.phoneBadgeContainer}>
            <View style={styles.phoneBadge}>
              <View style={styles.pulseDot} />
              <Ionicons name="phone-portrait-outline" size={15} color="#0F766E" style={{ marginRight: 6 }} />
              <Text style={styles.phoneBadgeText}>
                SMS sent to: <Text style={styles.phoneNumberBold}>{phone}</Text>
              </Text>
            </View>
            {patientName ? (
              <Text style={styles.patientNameText}>Patient: {patientName}</Text>
            ) : null}
          </View>

          {/* Live SMS Dispatched Simulator Banner */}
          {activeCode ? (
            <View style={styles.smsSimulatorBox}>
              <View style={styles.smsSimulatorHeader}>
                <View style={styles.smsSimIconRow}>
                  <Ionicons name="chatbox-ellipses" size={14} color="#0D9488" style={{ marginRight: 5 }} />
                  <Text style={styles.smsSimulatorTitle}>LIVE SMS GATEWAY PREVIEW</Text>
                </View>
                <TouchableOpacity
                  style={styles.quickFillChip}
                  onPress={() => handleQuickFill(activeCode)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flash" size={12} color={Colors.white} style={{ marginRight: 4 }} />
                  <Text style={styles.quickFillText}>Quick-Fill ({activeCode})</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.smsSimulatorBody}>
                {smsMessagePreview ||
                  `"[Medi-Queue] Your verification OTP is ${activeCode}. Valid for 10 minutes."`}
              </Text>
            </View>
          ) : null}

          {/* OTP Input Field */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Enter 6-Digit OTP Code:</Text>
            <TextInput
              ref={inputRef}
              style={[
                styles.otpInput,
                error ? styles.otpInputError : null,
              ]}
              placeholder="• • • • • •"
              placeholderTextColor="#94A3B8"
              value={otp}
              onChangeText={(val) => {
                const numericOnly = val.replace(/[^0-9]/g, '');
                setOtp(numericOnly);
                setError(null);
                if (numericOnly.length === 6) {
                  handleVerify(numericOnly);
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              selectTextOnFocus
            />
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          {/* Resend Section */}
          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>Didn't receive code?</Text>
            <TouchableOpacity
              onPress={dispatchOtp}
              disabled={sending || resendCountdown > 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.resendBtnText,
                  (sending || resendCountdown > 0) && styles.resendBtnDisabled,
                ]}
              >
                {sending
                  ? 'Sending...'
                  : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : 'Resend OTP Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || otp.length < 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <View style={styles.btnInnerRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.verifyButtonText}>Verify & Complete Registration</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Skip / Emergency Bypass (Optional) */}
          {onSkip ? (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Emergency / Register Without Phone OTP</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shieldIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBadgeContainer: {
    marginBottom: 14,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D9488',
    marginRight: 8,
  },
  phoneBadgeText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '500',
  },
  phoneNumberBold: {
    fontWeight: '800',
    color: '#0F766E',
  },
  patientNameText: {
    fontSize: 11,
    color: Colors.textMedium,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '600',
  },
  smsSimulatorBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  smsSimulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  smsSimIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smsSimulatorTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  quickFillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickFillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },
  smsSimulatorBody: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputSection: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 8,
  },
  otpInput: {
    height: 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    gap: 6,
  },
  resendHint: {
    fontSize: 12,
    color: Colors.textMedium,
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  resendBtnDisabled: {
    color: '#94A3B8',
  },
  verifyButton: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  skipBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
    textDecorationLine: 'underline',
  },
});

export default PatientOtpModal;
