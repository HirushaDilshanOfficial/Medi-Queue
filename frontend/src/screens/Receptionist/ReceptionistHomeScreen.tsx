import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReceptionistHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receptionist Dashboard</Text>
      <Text>Manage queues and register patients here.</Text>
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
