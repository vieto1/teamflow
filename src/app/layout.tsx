import type { Metadata, Viewport } from 'next';
import PwaClient from './pwa-client';
import './globals.css';
import './midnight.css';
import './glass-workspace.css';
export const metadata: Metadata = { title: 'Teamflow · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.', manifest: '/teamflow/manifest.webmanifest', applicationName: 'Teamflow', appleWebApp: { capable: true, title: 'Teamflow', statusBarStyle: 'default' }, formatDetection: { telephone: false }, icons: { icon: [{ url: '/teamflow/tf-monogram-icon-v1.png', type: 'image/png', sizes: '64x64' },{url:'/teamflow/tf-monogram-v1.ico',type:'image/x-icon',sizes:'16x16 32x32 48x48 64x64'}], shortcut: '/teamflow/tf-monogram-v1.ico', apple: [{url:'/teamflow/tf-monogram-apple-v1.png',sizes:'180x180',type:'image/png'}] } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#080f17' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body><PwaClient/>{children}</body></html>; }

