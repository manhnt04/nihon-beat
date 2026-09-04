import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './audition.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hanzibeat.online'),
  applicationName: 'Hanzi Beat',
  title: {
    default: 'Hanzi Beat — Học Hán tự qua trò chơi',
    template: '%s · Hanzi Beat',
  },
  description: 'Game học tiếng Trung, chữ Hán, pinyin và từ vựng HSK qua thử thách, PvP và Hán Tự Thành.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Hanzi Beat',
    description: 'Học Hán tự qua trò chơi, thử thách và PvP.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hanzi Beat',
    description: 'Học Hán tự qua trò chơi, thử thách và PvP.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
