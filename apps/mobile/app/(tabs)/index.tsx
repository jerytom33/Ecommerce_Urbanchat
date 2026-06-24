/**
 * Home tab screen.
 * Displays featured products and storefront branding.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to the Store</Text>
        <Text style={styles.subtitle}>Browse our latest products</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Products</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Products will appear here</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212B36',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#637381',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212B36',
    marginBottom: 12,
  },
  placeholder: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DFE3E8',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#637381',
    fontSize: 14,
  },
});
