/**
 * Search tab screen.
 * Allows customers to search and filter products.
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search products..."
          placeholderTextColor="#637381"
        />
      </View>
      <View style={styles.content}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Search results will appear here
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DFE3E8',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212B36',
    borderWidth: 1,
    borderColor: '#DFE3E8',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE3E8',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#637381',
    fontSize: 14,
  },
});
