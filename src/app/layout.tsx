import type { Metadata } from 'next';
import './globals.css';
import './midnight.css';
export const metadata: Metadata = { title: 'Teamflow · Meetings & Aufgaben', description: 'Die Teamzentrale für Meetings, Notizen und nächste Schritte.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}</body></html>; }
