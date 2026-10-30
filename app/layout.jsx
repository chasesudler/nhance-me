import './globals.css';
import './mobile.css';
import Script from 'next/script';

export const metadata = {
  title: 'Nhance Me | AI Real Estate Photo Enhancement',
  description: 'Fast, consistent real estate image enhancement and virtual staging.',
  manifest: '/manifest.json',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nhance Me' },
};

export const viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`}
        </Script>
      </body>
    </html>
  );
}
