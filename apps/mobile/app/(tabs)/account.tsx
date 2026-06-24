/**
 * Account tab screen.
 * Displays customer profile, orders, and settings.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Sign in to view your profile</Text>
        <View style={styles.menuSection}>
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>Orders</Text>
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>Addresses</Text>
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>Settings</Text>
          </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DFE3E8',
  },
  avatarText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212B36',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#637381',
    marginBottom: 32,
  },
  menuSection: {
    width: '100%',
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DFE3E8',
  },
  menuText: {
    fontSize: 16,
    color: '#212B36',
  },
});
