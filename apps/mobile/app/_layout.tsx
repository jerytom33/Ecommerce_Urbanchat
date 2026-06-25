/**
 * Root layout for the Expo Router app.
 * Wraps all screens with the ThemeProvider for whitelabel branding.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="product/[id]"
          options={{ headerShown: true, title: 'Product' }}
        />
        <Stack.Screen
          name="checkout"
          options={{ headerShown: true, title: 'Checkout', presentation: 'modal' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
