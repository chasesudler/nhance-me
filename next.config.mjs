/** @type {import('next').NextConfig} */
const isMobileBuild = process.env.MOBILE_BUILD === '1';

const nextConfig = {
  images: { unoptimized: true },
  // Capacitor mobile builds need a fully static export served from the
  // native webview. API routes are not exported; the app calls them on the
  // deployed web backend via NEXT_PUBLIC_API_BASE instead.
  ...(isMobileBuild ? { output: 'export' } : {}),
};

export default nextConfig;
