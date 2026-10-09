import { LocalizedText as Text } from '../i18n/LocalizedText';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../constants/Colors';

export type ScannerMode = 'barcode_machine' | 'camera';

export interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (scannedValue: string) => void;
  initialMode?: ScannerMode;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  initialMode = 'barcode_machine',
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const [manualCode, setManualCode] = useState<string>('');
  const [scannedRecently, setScannedRecently] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const inputRef = useRef<TextInput>(null);

  // Scan line animation for camera viewfinder
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setManualCode('');
      setScannedRecently(false);
      // Auto-focus manual/barcode machine input
      setTimeout(() => {
        if (mode === 'barcode_machine') {
          inputRef.current?.focus();
        }
      }, 350);
    }
  }, [visible, mode]);

  useEffect(() => {
    if (visible && mode === 'camera') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 180,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, mode, scanLineAnim]);

  const handleBarcodeScanned = (scannedData: string) => {
    if (scannedRecently || !scannedData) return;
    setScannedRecently(true);
    onScan(scannedData.trim());
    onClose();
  };

  const handleManualOrGunSubmit = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    handleBarcodeScanned(trimmed);
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
          {/* ── HEADER WITH CLOSE (X) MARK ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <Ionicons
                  name={mode === 'camera' ? 'camera' : 'barcode-outline'}
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {mode === 'camera' ? t('Camera QR Scanner') : t('Barcode Checker Machine')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {mode === 'camera'
                    ? t('Align QR or barcode inside viewfinder')
                    : t('USB Barcode Gun & Desk Reader Standby')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel={t("Close Scanner")}
            >
              <Ionicons name="close" size={20} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>

          {/* ── MODE SWITCHER TABS ── */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                mode === 'barcode_machine' && styles.tabBtnActive,
              ]}
              onPress={() => setMode('barcode_machine')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="barcode-outline"
                size={16}
                color={mode === 'barcode_machine' ? Colors.primary : Colors.textLight}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  mode === 'barcode_machine' && styles.tabTextActive,
                ]}
              >
                {t("Barcode Machine (Gun)")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                mode === 'camera' && styles.tabBtnActive,
              ]}
              onPress={() => setMode('camera')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={mode === 'camera' ? Colors.primary : Colors.textLight}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  mode === 'camera' && styles.tabTextActive,
                ]}
              >
                {t("Device Camera")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── TAB 1: BARCODE MACHINE / GUN MODE ── */}
          {mode === 'barcode_machine' && (
            <View style={styles.machineContent}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>{t("Scanned Barcode / QR Code Value:")}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.barcodeInput}
                  placeholder={t("Scan or enter Barcode / NIC / Booking Ref...")}
                  placeholderTextColor={Colors.textLight}
                  value={manualCode}
                  onChangeText={(text) => {
                    setManualCode(text);
                    // If hardware barcode gun sends fast input with trailing carriage return
                    if (text.endsWith('\n') || text.endsWith('\r')) {
                      handleBarcodeScanned(text.replace(/[\r\n]/g, ''));
                    }
                  }}
                  autoFocus
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleManualOrGunSubmit}
                />
              </View>

              <View style={styles.machineActionsRow}>
                <TouchableOpacity
                  style={styles.checkBarcodeBtn}
                  onPress={handleManualOrGunSubmit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.checkBarcodeBtnText}>{t("Check & Auto-Fill Record")}</Text>
                </TouchableOpacity>
              </View>

              {/* Demo test helper */}
              <View style={styles.testHintRow}>
                <Text style={styles.testHintLabel}>{t("No physical gun? Quick test:")}</Text>
                <TouchableOpacity
                  style={styles.testChip}
                  onPress={() => {
                    setManualCode('197824190V');
                    setTimeout(() => handleBarcodeScanned('197824190V'), 100);
                  }}
                >
                  <Text style={styles.testChipText}>{t("NIC: 197824190V")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── TAB 2: DEVICE CAMERA SCANNER MODE ── */}
          {mode === 'camera' && (
            <View style={styles.cameraContent}>
              {!permission?.granted ? (
                <View style={styles.permissionBox}>
                  <Ionicons name="camera-reverse-outline" size={42} color={Colors.textLight} />
                  <Text style={styles.permissionTitle}>{t("Camera Access Required")}</Text>
                  <Text style={styles.permissionSub}>
                    {t("Allow camera access to scan patient appointment QR codes and digital health passes.")}
                  </Text>
                  <TouchableOpacity
                    style={styles.grantBtn}
                    onPress={requestPermission}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.grantBtnText}>{t("Grant Camera Access")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraFrameWrap}>
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: [
                        'qr',
                        'code128',
                        'code39',
                        'code93',
                        'codabar',
                        'ean13',
                        'ean8',
                        'upc_a',
                        'upc_e',
                        'itf14',
                        'pdf417',
                        'datamatrix',
                        'aztec',
                      ],
                    }}
                    onBarcodeScanned={(result) => {
                      if (result?.data) {
                        handleBarcodeScanned(result.data);
                      }
                    }}
                  >
                    {/* Viewfinder Target Frame */}
                    <View style={styles.viewfinder}>
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />

                      <Animated.View
                        style={[
                          styles.scanLine,
                          {
                            transform: [{ translateY: scanLineAnim }],
                          },
                        ]}
                      />
                    </View>
                  </CameraView>
                  <Text style={styles.cameraHint}>
                    {t("Hold patient phone or slip steady inside frame")}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── FOOTER CLOSE BUTTON ── */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>{t("Cancel")}</Text>
          </TouchableOpacity>
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
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  headerSubtitle: {
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMedium,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  machineContent: {
    paddingVertical: 6,
  },
  inputWrap: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  barcodeInput: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: Colors.textDark,
  },
  machineActionsRow: {
    marginBottom: 12,
  },
  checkBarcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 46,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  checkBarcodeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  testHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  testHintLabel: {
    fontSize: 11,
    color: Colors.textLight,
  },
  testChip: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  cameraContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  permissionBox: {
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginTop: 12,
    marginBottom: 6,
  },
  permissionSub: {
    fontSize: 12,
    color: Colors.textMedium,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  grantBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  cameraFrameWrap: {
    width: '100%',
    alignItems: 'center',
  },
  cameraView: {
    width: 260,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 180,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLine: {
    height: 2,
    backgroundColor: '#38BDF8',
    width: '100%',
  },
  cameraHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 12,
    fontWeight: '500',
  },
  cancelBtn: {
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMedium,
  },
});

export default BarcodeScannerModal;
