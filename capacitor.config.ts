import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.repforge.tracker',
  appName: 'RepForge',
  webDir: 'dist',
  backgroundColor: '#0b0f14',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0b0f14',
  },
  android: {
    backgroundColor: '#0b0f14',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_repforge',
      iconColor: '#f97316',
    },
  },
};

export default config;
