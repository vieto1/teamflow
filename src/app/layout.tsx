import type { Metadata, Viewport } from 'next';
import PwaClient from './pwa-client';
import './globals.css';
import './midnight.css';
import './glass-workspace.css';
export const metadata: Metadata = { title: 'Teamflow · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.', manifest: '/teamflow/manifest.webmanifest', applicationName: 'Teamflow', appleWebApp: { capable: true, title: 'Teamflow', statusBarStyle: 'default' }, formatDetection: { telephone: false }, icons: { icon: [{url:'/teamflow/teamflow-safari-v2.ico',sizes:'any'},{url:'/teamflow/teamflow-safari-32-v2.png',type:'image/png',sizes:'32x32'},{url:'/teamflow/teamflow-safari-64-v2.png',type:'image/png',sizes:'64x64'}], shortcut:'/teamflow/teamflow-safari-v2.ico', apple:[{url:'/teamflow/teamflow-safari-touch-v2.png',sizes:'180x180',type:'image/png'}], other:[{rel:'mask-icon',url:'/teamflow/teamflow-safari-mask-v2.svg',color:'#b7a3ef'}] } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#080f17' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body><PwaClient/>{children}</body></html>; }

