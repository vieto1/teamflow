import type { Metadata, Viewport } from 'next';
import PwaClient from './pwa-client';
import './globals.css';
import './midnight.css';
import './glass-workspace.css';
export const metadata: Metadata = { title: 'Exit · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.', manifest: '/teamflow/manifest.webmanifest', applicationName: 'Exit', appleWebApp: { capable: true, title: 'Exit', statusBarStyle: 'default' }, formatDetection: { telephone: false }, icons: { icon: [{url:'/teamflow/exit-shift-v1.ico',sizes:'any'},{url:'/teamflow/exit-shift-32-v1.png',type:'image/png',sizes:'32x32'},{url:'/teamflow/exit-shift-64-v1.png',type:'image/png',sizes:'64x64'}], shortcut:'/teamflow/exit-shift-v1.ico', apple:[{url:'/teamflow/exit-shift-touch-v1.png',sizes:'180x180',type:'image/png'}], other:[{rel:'mask-icon',url:'/teamflow/exit-shift-mask-v1.svg',color:'#b7a3ef'}] } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#080f17' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body><PwaClient/>{children}</body></html>; }

