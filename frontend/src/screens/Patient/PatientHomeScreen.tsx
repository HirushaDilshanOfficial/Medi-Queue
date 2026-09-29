import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PatientHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Patient Dashboard</Text>
      <Text>View your queues and medical history here.</Text>
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
