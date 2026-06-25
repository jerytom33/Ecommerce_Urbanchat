/**
 * Home tab screen.
 * Displays featured products and storefront branding with pull-to-refresh.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api-client';
import { useTheme } from '@/providers/ThemeProvider';

interface Product {
  id: string;
  title: string;
  description?: string;
  status: string;
  listings?: Array<{ price: string }>;
  media?: Array<{ url: string }>;
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setError(null);
    // Fetch product list
    const response = await api.get<{ data: any[] }>('products?status=active&limit=10');
    if (response.error) {
      setError(response.error);
      return;
    }
    if (!response.data) return;

    const productList = (response.data as any).data || response.data || [];

    // Fetch details (with media/listings) for each product
    const detailed = await Promise.all(
      productList.slice(0, 10).map(async (p: any) => {
        const detail = await api.get<{ data: Product }>(`products/${p.id}`);
        if (detail.data) {
          return (detail.data as any).data || detail.data;
        }
        return p;
      })
    );
    setProducts(detailed);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts().finally(() => setLoading(false));
  }, [fetchProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  const navigateToProduct = (id: string) => {
    router.push(`/product/${id}`);
  };

  const renderProductCard = ({ item }: { item: Product }) => {
    const price = item.listings?.[0]?.price ? Number(item.listings[0].price) : 0;
    const imageUrl = item.media?.[0]?.url;
    return (
      <TouchableOpacity
        style={[styles.productCard, { borderColor: theme.colors.border }]}
        onPress={() => navigateToProduct(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, $${price.toFixed(2)}`}
      >
        <View
          style={[
            styles.productImage,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Text style={styles.imagePlaceholder}>📷</Text>
          )}
        </View>
        <Text style={[styles.productTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.productPrice, { color: theme.colors.primary }]}>
          ${price.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderGridCard = ({ item }: { item: Product }) => {
    const price = item.listings?.[0]?.price ? Number(item.listings[0].price) : 0;
    const imageUrl = item.media?.[0]?.url;
    return (
      <TouchableOpacity
        style={[styles.gridCard, { borderColor: theme.colors.border }]}
        onPress={() => navigateToProduct(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, $${price.toFixed(2)}`}
      >
        <View
          style={[
            styles.gridImage,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Text style={styles.imagePlaceholder}>📷</Text>
          )}
        </View>
        <Text style={[styles.productTitle, { color: theme.colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.productPrice, { color: theme.colors.primary }]}>
          ${price.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  };

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
          Failed to load products
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            setLoading(true);
            fetchProducts().finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const featured = products.slice(0, 5);
  const newArrivals = products.slice(5);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Hero Banner */}
      <View style={[styles.heroBanner, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.heroTitle}>Welcome to Our Store</Text>
        <Text style={styles.heroSubtitle}>Discover amazing products</Text>
      </View>

      {/* Featured Products - Horizontal Scroll */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Featured Products
        </Text>
        {featured.length > 0 ? (
          <FlatList
            data={featured}
            renderItem={renderProductCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No featured products yet
          </Text>
        )}
      </View>

      {/* New Arrivals - Grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          New Arrivals
        </Text>
        {newArrivals.length > 0 ? (
          <FlatList
            data={newArrivals}
            renderItem={renderGridCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Check back soon for new arrivals
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.6;
const GRID_CARD_WIDTH = (width - 48) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBanner: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  horizontalList: {
    paddingRight: 16,
  },
  productCard: {
    width: CARD_WIDTH,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    fontSize: 32,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
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
