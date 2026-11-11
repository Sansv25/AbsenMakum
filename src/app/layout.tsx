import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Absensi Piket',
  description: 'Dokumentasi absensi piket harian',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-gray-50 text-gray-900 font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
