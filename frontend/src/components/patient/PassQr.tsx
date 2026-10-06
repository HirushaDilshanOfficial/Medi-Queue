import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  value: string;
  size?: number;
};

type BoundaryState = { failed: boolean };

// A printed or scanned pass is the fallback when a patient cannot show their phone,
// so a failed QR must degrade to a readable code rather than take the screen down.
// react-native-svg is a native module, so this also covers a build that is missing
// it (a bare workflow without a development build).
class QrBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackText}>Pass code unavailable</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function PassQr({ value, size = 168 }: Props) {
  if (!value) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={styles.fallback}>Pass code unavailable</Text>
      </View>
    );
  }

  return (
    <QrBoundary>
      <View
        style={[styles.box, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel="Scannable pass code"
      >
        <QRCode
          value={value}
          size={size - 24}
          backgroundColor="#FFFFFF"
          color={PatientTheme.textPrimary}
          // Raised error correction: hospital passes get scanned off cracked
          // screens and smudged printouts.
          ecl="H"
        />
      </View>
    </QrBoundary>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PatientTheme.radiusMd,
    borderWidth: 1,
    borderColor: PatientTheme.border,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  fallback: {
    fontSize: 11,
    color: PatientTheme.textMuted,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 11,
    color: PatientTheme.textMuted,
    textAlign: 'center',
  },
});
