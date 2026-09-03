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
  title: 'Hanzi Beat — Học tiếng Trung theo nhịp',
  description: 'Game nhịp điệu kết hợp học chữ Hán, pinyin và từ vựng tiếng Trung từ HSK 1 đến HSK 6.',
  openGraph: {
    title: 'Hanzi Beat',
    description: 'Bắt đúng nhịp. Nhớ trọn Hán tự.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hanzi Beat',
    description: 'Bắt đúng nhịp. Nhớ trọn Hán tự.',
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
