import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DoctorHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctor Dashboard</Text>
      <Text>View appointments and patient records here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
