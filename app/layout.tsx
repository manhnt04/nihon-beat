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
  title: 'Nihon Beat — Học tiếng Nhật theo nhịp',
  description: 'Game nhịp điệu kết hợp học từ vựng tiếng Nhật từ N5 đến N1.',
  openGraph: {
    title: 'Nihon Beat',
    description: 'Chạm đúng nhịp. Nhớ đúng từ.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nihon Beat',
    description: 'Chạm đúng nhịp. Nhớ đúng từ.',
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
