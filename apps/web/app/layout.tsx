import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRUD Personas — Node.js + MySQL',
  description: 'Frontend del microservicio CRUD de personas (Express + MySQL)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
