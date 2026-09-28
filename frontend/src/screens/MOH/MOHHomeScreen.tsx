import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MOHHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MOH Dashboard</Text>
      <Text>View health statistics and reports here.</Text>
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
