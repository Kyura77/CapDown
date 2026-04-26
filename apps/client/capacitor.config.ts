import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.capdown.app',
  appName: 'CapDown',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['192.168.100.14', '127.0.0.1', 'localhost']
  }
};

export default config;
