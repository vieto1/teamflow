import type { Metadata, Viewport } from 'next';
import PwaClient from './pwa-client';
import './globals.css';
import './midnight.css';
export const metadata: Metadata = { title: 'Teamflow · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.', manifest: '/teamflow/manifest.webmanifest', applicationName: 'Teamflow', appleWebApp: { capable: true, title: 'Teamflow', statusBarStyle: 'default' }, formatDetection: { telephone: false }, icons: { icon: [{ url: '/teamflow/teamflow-icon.png?v=orbit1', type: 'image/png', sizes: '64x64' },{url:'/teamflow/favicon.ico?v=orbit1',sizes:'any'}], apple: '/teamflow/apple-touch-icon.png?v=orbit1' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#080f17' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body><PwaClient/>{children}</body></html>; }
