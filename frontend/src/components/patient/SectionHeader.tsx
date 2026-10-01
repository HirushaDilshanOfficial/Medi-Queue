import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PatientTheme } from '../../constants/PatientTheme';

type Props = {
  title: string;
  onSeeAllPress?: () => void;
};

export function SectionHeader({ title, onSeeAllPress }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={onSeeAllPress}
        accessibilityRole="button"
        accessibilityLabel={`See all ${title}`}
        hitSlop={8}
      >
        <Text style={styles.seeAll}>See All</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: PatientTheme.textPrimary,
    fontSize: PatientTheme.designType.section,
    fontWeight: '800',
  },
  seeAll: {
    color: PatientTheme.brand,
    fontSize: PatientTheme.designType.item,
    fontWeight: '600',
  },
});
