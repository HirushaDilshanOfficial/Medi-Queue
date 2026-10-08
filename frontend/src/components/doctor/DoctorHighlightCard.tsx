import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { DOCTOR_TOKENS as C } from './doctorTheme';

interface DoctorHighlightCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const DoctorHighlightCard = ({ children, style }: DoctorHighlightCardProps) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.tint,
    borderWidth: 1,
    borderColor: C.tintBorder,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
  },
});
