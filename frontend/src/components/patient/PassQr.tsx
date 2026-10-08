import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  value: string;
  size?: number;
};

type BoundaryState = { failed: boolean };

function UnavailablePass() {
  const { t } = useLanguage();
  return <View style={styles.fallbackBox}><Text style={styles.fallbackText}>{t('Pass code unavailable')}</Text></View>;
}

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
        <UnavailablePass />
      );
    }
    return this.props.children;
  }
}

export function PassQr({ value, size = 168 }: Props) {
  const { t } = useLanguage();
  if (!value) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={styles.fallback}>{t("Pass code unavailable")}</Text>
      </View>
    );
  }

  return (
    <QrBoundary>
      <View
        style={[styles.box, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel={t("Scannable pass code")}
      >
        <QRCode
          value={value}
          size={size - 24}
          backgroundColor="#FFFFFF"
          color="#000000"
          // Raised error correction: hospital passes get scanned off cracked
          // screens and smudged printouts.
          ecl="Q"
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
