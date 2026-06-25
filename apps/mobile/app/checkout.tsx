/**
 * Checkout screen.
 * Collects shipping address and processes a simulated payment.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { api } from '@/lib/api-client';
import { useTheme } from '@/providers/ThemeProvider';

interface AddressForm {
  email: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [address, setAddress] = useState<AddressForm>({
    email: '',
    line1: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const updateField = (field: keyof AddressForm, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return (
      address.email.trim() !== '' &&
      address.line1.trim() !== '' &&
      address.city.trim() !== '' &&
      address.state.trim() !== '' &&
      address.zip.trim() !== '' &&
      address.country.trim() !== ''
    );
  };

  const handlePlaceOrder = async () => {
    if (!isFormValid()) {
      setError('Please fill in all fields');
      return;
    }

    setProcessing(true);
    setError(null);

    const response = await api.post<{ orderId: string }>('checkout/pay', {
      shippingAddress: {
        line1: address.line1,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
      },
      email: address.email,
    });

    setProcessing(false);

    if (response.error) {
      setError('Payment failed. Please try again.');
    } else if (response.data) {
      setOrderId(response.data.orderId);
    }
  };

  // Success State
  if (orderId) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Order Confirmed' }} />
        <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={[styles.successTitle, { color: theme.colors.text }]}>
            Order Placed!
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.colors.textSecondary }]}>
            Your order has been confirmed
          </Text>
          <View style={[styles.orderIdBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.orderIdLabel, { color: theme.colors.textSecondary }]}>
              Order ID
            </Text>
            <Text style={[styles.orderIdValue, { color: theme.colors.text }]}>
              {orderId}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/(tabs)')}
            accessibilityRole="button"
          >
            <Text style={styles.continueText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Checkout' }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Email */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Contact
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Email address"
              placeholderTextColor={theme.colors.textSecondary}
              value={address.email}
              onChangeText={(v) => updateField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email address"
            />
          </View>

          {/* Shipping Address */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Shipping Address
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Address line 1"
              placeholderTextColor={theme.colors.textSecondary}
              value={address.line1}
              onChangeText={(v) => updateField('line1', v)}
              accessibilityLabel="Address line 1"
            />
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="City"
              placeholderTextColor={theme.colors.textSecondary}
              value={address.city}
              onChangeText={(v) => updateField('city', v)}
              accessibilityLabel="City"
            />
            <View style={styles.row}>
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                placeholder="State"
                placeholderTextColor={theme.colors.textSecondary}
                value={address.state}
                onChangeText={(v) => updateField('state', v)}
                accessibilityLabel="State"
              />
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                placeholder="ZIP code"
                placeholderTextColor={theme.colors.textSecondary}
                value={address.zip}
                onChangeText={(v) => updateField('zip', v)}
                keyboardType="number-pad"
                accessibilityLabel="ZIP code"
              />
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Country"
              placeholderTextColor={theme.colors.textSecondary}
              value={address.country}
              onChangeText={(v) => updateField('country', v)}
              accessibilityLabel="Country"
            />
          </View>

          {/* Error Message */}
          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
        </ScrollView>

        {/* Place Order Button */}
        <View style={[styles.bottomBar, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.placeOrderButton,
              {
                backgroundColor: isFormValid()
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
            onPress={handlePlaceOrder}
            disabled={processing || !isFormValid()}
            accessibilityRole="button"
            accessibilityLabel="Place order"
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.placeOrderText}>Place Order</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
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
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
  placeOrderButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  orderIdBox: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  orderIdLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  continueButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
