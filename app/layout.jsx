import './globals.css';
import './mobile.css';
import Script from 'next/script';

const siteTitle = 'Real Estate Photo Enhancement and Virtual Staging for Agents and Photographers | Nhance Me';
const siteDescription = 'AI real estate photo enhancement and virtual staging for agents and photographers. Enhance listing photos and stage empty rooms online, then export listing-ready images. Try Nhance Me by Chasen Tech.';

export const metadata = {
  metadataBase: new URL('https://nhanceme.today'),
  title: siteTitle,
  description: siteDescription,
  keywords: ['real estate photo enhancement', 'AI real estate photo editing', 'virtual staging', 'listing photo enhancement', 'real estate photo editor'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Nhance Me',
    title: siteTitle,
    description: siteDescription,
    url: '/',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Nhance Me — AI real estate photo enhancement and virtual staging by Chasen Tech',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: siteTitle,
    description: siteDescription,
    images: ['/icons/icon-512.png'],
  },
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
