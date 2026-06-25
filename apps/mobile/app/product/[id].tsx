/**
 * Product detail screen.
 * Displays full product info with variant selector, quantity picker, and add-to-cart.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '@/lib/api-client';
import { useTheme } from '@/providers/ThemeProvider';

interface ProductVariant {
  id: string;
  title: string;
  price: number;
  sku?: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  variants?: ProductVariant[];
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const fetchProduct = useCallback(async () => {
    setError(null);
    const response = await api.get<Product>(`products/${id}`);
    if (response.error) {
      setError(response.error);
    } else if (response.data) {
      setProduct(response.data);
      if (response.data.variants && response.data.variants.length > 0) {
        setSelectedVariant(response.data.variants[0]);
      }
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchProduct().finally(() => setLoading(false));
  }, [fetchProduct]);

  const handleAddToCart = async () => {
    if (!product) return;

    setAddingToCart(true);
    const body: Record<string, unknown> = {
      productId: product.id,
      quantity,
    };
    if (selectedVariant) {
      body.variantId = selectedVariant.id;
    }

    const response = await api.post('cart/items', body);
    setAddingToCart(false);

    if (response.error) {
      Alert.alert('Error', 'Could not add item to cart. Please try again.');
    } else {
      Alert.alert('Added to Cart', `${product.title} has been added to your cart.`, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
      ]);
    }
  };

  const currentPrice = selectedVariant?.price ?? product?.price ?? 0;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Product' }} />
        <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Product' }} />
        <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Failed to load product
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setLoading(true);
              fetchProduct().finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: product.title }} />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Product Image */}
          <View
            style={[styles.imageContainer, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={styles.imagePlaceholder}>📷</Text>
          </View>

          {/* Product Info */}
          <View style={styles.infoSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {product.title}
            </Text>
            <Text style={[styles.price, { color: theme.colors.primary }]}>
              ${currentPrice.toFixed(2)}
            </Text>

            {product.description ? (
              <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                {product.description}
              </Text>
            ) : null}

            {/* Variant Selector */}
            {product.variants && product.variants.length > 1 && (
              <View style={styles.variantsSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                  Options
                </Text>
                <View style={styles.variantsList}>
                  {product.variants.map((variant) => (
                    <TouchableOpacity
                      key={variant.id}
                      style={[
                        styles.variantChip,
                        {
                          borderColor:
                            selectedVariant?.id === variant.id
                              ? theme.colors.primary
                              : theme.colors.border,
                          backgroundColor:
                            selectedVariant?.id === variant.id
                              ? `${theme.colors.primary}10`
                              : theme.colors.background,
                        },
                      ]}
                      onPress={() => setSelectedVariant(variant)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedVariant?.id === variant.id }}
                    >
                      <Text
                        style={[
                          styles.variantText,
                          {
                            color:
                              selectedVariant?.id === variant.id
                                ? theme.colors.primary
                                : theme.colors.text,
                          },
                        ]}
                      >
                        {variant.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Quantity Selector */}
            <View style={styles.quantitySection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Quantity
              </Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={[styles.quantityBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  accessibilityLabel="Decrease quantity"
                >
                  <Text style={[styles.quantityBtnText, { color: theme.colors.text }]}>
                    −
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.quantityValue, { color: theme.colors.text }]}>
                  {quantity}
                </Text>
                <TouchableOpacity
                  style={[styles.quantityBtn, { borderColor: theme.colors.border }]}
                  onPress={() => setQuantity((q) => q + 1)}
                  accessibilityLabel="Increase quantity"
                >
                  <Text style={[styles.quantityBtnText, { color: theme.colors.text }]}>
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Add to Cart Button */}
        <View style={[styles.bottomBar, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.addToCartButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleAddToCart}
            disabled={addingToCart}
            accessibilityRole="button"
            accessibilityLabel="Add to cart"
          >
            {addingToCart ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addToCartText}>Add to Cart</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const { width } = Dimensions.get('window');

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
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: width,
    height: width * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    fontSize: 64,
  },
  infoSection: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  variantsSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  variantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  variantText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quantitySection: {
    marginBottom: 20,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  addToCartButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
