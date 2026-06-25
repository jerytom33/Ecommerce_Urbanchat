/**
 * Cart tab screen.
 * Displays items in the shopping cart with quantity controls and checkout trigger.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api-client';
import { useTheme } from '@/providers/ThemeProvider';

interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    setError(null);
    const response = await api.get<Cart>('cart');
    if (response.error) {
      setError(response.error);
    } else if (response.data) {
      setCart(response.data);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCart().finally(() => setLoading(false));
  }, [fetchCart]);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId);
      return;
    }

    setUpdatingItem(itemId);
    const response = await api.patch<Cart>(`cart/items/${itemId}`, {
      quantity: newQuantity,
    });
    if (response.data) {
      setCart(response.data);
    }
    setUpdatingItem(null);
  };

  const removeItem = async (itemId: string) => {
    Alert.alert('Remove Item', 'Remove this item from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUpdatingItem(itemId);
          const response = await api.delete<Cart>(`cart/items/${itemId}`);
          if (response.data) {
            setCart(response.data);
          }
          setUpdatingItem(null);
        },
      },
    ]);
  };

  const goToCheckout = () => {
    router.push('/checkout');
  };

  const goShopping = () => {
    router.push('/(tabs)');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { borderBottomColor: theme.colors.border }]}>
      <View style={[styles.itemImage, { backgroundColor: theme.colors.surface }]}>
        <Text style={styles.imagePlaceholder}>📷</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.itemPrice, { color: theme.colors.primary }]}>
          ${item.price.toFixed(2)}
        </Text>
        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={[styles.quantityBtn, { borderColor: theme.colors.border }]}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            disabled={updatingItem === item.id}
            accessibilityLabel="Decrease quantity"
          >
            <Text style={[styles.quantityBtnText, { color: theme.colors.text }]}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.quantityText, { color: theme.colors.text }]}>
            {item.quantity}
          </Text>
          <TouchableOpacity
            style={[styles.quantityBtn, { borderColor: theme.colors.border }]}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            disabled={updatingItem === item.id}
            accessibilityLabel="Increase quantity"
          >
            <Text style={[styles.quantityBtnText, { color: theme.colors.text }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => removeItem(item.id)}
        accessibilityLabel="Remove item"
      >
        <Text style={[styles.deleteText, { color: theme.colors.error }]}>✕</Text>
      </TouchableOpacity>
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
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Failed to load cart
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            setLoading(true);
            fetchCart().finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          Your cart is empty
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
          Add products to your cart to see them here
        </Text>
        <TouchableOpacity
          style={[styles.shopButton, { backgroundColor: theme.colors.primary }]}
          onPress={goShopping}
        >
          <Text style={styles.shopButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={cart.items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />

      {/* Order Summary */}
      <View style={[styles.summary, { borderTopColor: theme.colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Subtotal
          </Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            ${cart.subtotal.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Shipping
          </Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            ${cart.shipping.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: theme.colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: theme.colors.text }]}>
            ${cart.total.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, { backgroundColor: theme.colors.primary }]}
          onPress={goToCheckout}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  list: {
    paddingTop: 8,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    fontSize: 28,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  deleteBtn: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  deleteText: {
    fontSize: 18,
    fontWeight: '600',
  },
  summary: {
    padding: 16,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DFE3E8',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  checkoutButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
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
