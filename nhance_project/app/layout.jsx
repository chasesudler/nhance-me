import './globals.css';

export const metadata = {
  title: 'Nhance Me | AI Real Estate Photo Enhancement',
  description: 'Fast, consistent real estate image enhancement and virtual staging.',
  manifest: '/manifest.json',
  themeColor: '#1B4383',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nhance Me' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}`}} />
      </body>
    </html>
  );
}
