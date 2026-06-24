import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: 'Storefront',
  slug: 'storefront-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ecommerce.storefront',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.ecommerce.storefront',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  scheme: 'storefront',
  plugins: ['expo-router'],
  extra: {
    eas: {
      projectId: 'placeholder-project-id',
    },
    storefrontApiBaseUrl:
      process.env.EXPO_PUBLIC_STOREFRONT_API_URL ||
      'http://localhost:3333/api/v1/storefront/',
  },
  experiments: {
    typedRoutes: true,
  },
});
