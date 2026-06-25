/**
 * Account tab screen.
 * Displays customer profile, order history, and settings.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { api } from '@/lib/api-client';

interface UserProfile {
  id: string;
  email: string;
  name: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export default function AccountScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = useCallback(async () => {
    setError(null);

    const [profileRes, ordersRes] = await Promise.all([
      api.get<UserProfile>('account/profile'),
      api.get<{ orders: Order[] } | Order[]>('account/orders'),
    ]);

    if (profileRes.error && ordersRes.error) {
      setError('Failed to load account data');
    } else {
      if (profileRes.data) {
        setProfile(profileRes.data);
      }
      if (ordersRes.data) {
        const list = Array.isArray(ordersRes.data)
          ? ordersRes.data
          : ordersRes.data.orders || [];
        setOrders(list);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAccountData().finally(() => setLoading(false));
  }, [fetchAccountData]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await api.post('auth/logout');
          setProfile(null);
          setOrders([]);
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return theme.colors.success;
      case 'cancelled':
      case 'refunded':
        return theme.colors.error;
      case 'processing':
      case 'shipped':
        return theme.colors.secondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, { borderColor: theme.colors.border }]}>
      <View style={styles.orderHeader}>
        <Text style={[styles.orderNumber, { color: theme.colors.text }]}>
          #{item.orderNumber || item.id.slice(0, 8)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}20` },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <Text style={[styles.orderDate, { color: theme.colors.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <Text style={[styles.orderTotal, { color: theme.colors.text }]}>
          ${item.total.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            setLoading(true);
            fetchAccountData().finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={[styles.name, { color: theme.colors.text }]}>
          {profile?.name || 'Guest'}
        </Text>
        <Text style={[styles.email, { color: theme.colors.textSecondary }]}>
          {profile?.email || 'Not signed in'}
        </Text>
      </View>

      {/* Order History */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Order History
        </Text>
        {orders.length > 0 ? (
          <FlatList
            data={orders}
            renderItem={renderOrder}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={[styles.emptyOrders, { borderColor: theme.colors.border }]}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No orders yet
            </Text>
          </View>
        )}
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.menuText, { color: theme.colors.text }]}>Settings</Text>
          <Text style={[styles.menuArrow, { color: theme.colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Log Out */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: theme.colors.error }]}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={[styles.logoutText, { color: theme.colors.error }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 32,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 13,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyOrders: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuText: {
    fontSize: 16,
  },
  menuArrow: {
    fontSize: 22,
    fontWeight: '300',
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
