import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aapdanetra.responder',
  appName: 'AapdaNetra Responder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    // Enable haptics, geolocation, and push capabilities
  }
};

export default config;
