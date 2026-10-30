import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nhanceme.mobile',
  appName: 'Nhance Me',
  webDir: 'out',
  server: {
    // Serve the webview over https on Android so the app runs in a secure
    // context (crypto.randomUUID, etc.). iOS uses capacitor:// by default.
    androidScheme: 'https',
  },
  ios: {
    // Extend the webview under the notch/home indicator; the app's
    // viewport-fit=cover + mobile.css handle the safe areas.
    contentInset: 'always',
  },
};

export default config;
