import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codynamics.ironhell',
  appName: 'IRONHELL',
  webDir: 'www',
  ios: {
    scheme: 'IRONHELL',
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  server: {
    iosScheme: 'capacitor',
  },
};

export default config;
