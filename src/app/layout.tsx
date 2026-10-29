import type { Metadata } from 'next';
import './globals.css';
import './midnight.css';
export const metadata: Metadata = { title: 'Teamflow · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.', icons: { icon: [{ url: '/teamflow/teamflow-icon.png?v=orbit1', type: 'image/png', sizes: '64x64' },{url:'/teamflow/favicon.ico?v=orbit1',sizes:'any'}], apple: '/teamflow/apple-touch-icon.png?v=orbit1' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
