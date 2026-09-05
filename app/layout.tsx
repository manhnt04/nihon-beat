import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './audition.css';
import { generateFaqSchema } from '@/lib/seo-data';

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
    default: 'Hanzi Beat — Học Tiếng Trung Sơ Cấp, Luyện Gõ Pinyin & Nhớ Chữ Hán Nhanh',
    template: '%s · Hanzi Beat',
  },
  description:
    'Học tiếng Trung sơ cấp đến nâng cao cùng Hanzi Beat! Khám phá cách học tiếng Trung nhanh, phương pháp học từ vựng tiếng Trung nhớ lâu hơn 300% nhờ Spaced Repetition và nhịp điệu. Luyện gõ Pinyin, nhớ mặt chữ Hán HSK 1-4, thi đấu PvP trực tuyến hoàn toàn miễn phí.',
  keywords: [
    'Hanzi',
    'Hanzii',
    'học tiếng trung',
    'khóa học tiếng trung',
    'tiếng trung sơ cấp',
    'cách học tiếng trung nhanh',
    'phương pháp học từ vựng tiếng trung nhớ lâu',
    'học tiếng trung nhớ lâu',
    'phương pháp học tiếng trung',
    'hanzi beat',
    'hanzii dict',
    'từ điển hanzii',
    'học hán tự hanzi',
    'chữ hán hanzi',
    'cách nhớ chữ hán siêu tốc',
    'mẹo nhớ chữ hán',
    'luyện nhớ mặt chữ hán',
    'spaced repetition tiếng trung',
    'tiếng trung cho người mới bắt đầu',
    'tự học tiếng trung tại nhà',
    'lộ trình tự học tiếng trung',
    'tiếng trung giao tiếp cơ bản',
    'học tiếng trung online',
    'học tiếng trung miễn phí',
    'app học tiếng trung',
    'web học tiếng trung',
    'luyện gõ tiếng trung',
    'luyện gõ pinyin',
    'luyện đánh máy chữ hán',
    'gõ tiếng trung trên máy tính',
    'bàn phím tiếng trung',
    'typing test tiếng trung',
    'game luyện gõ bính âm',
    'học từ vựng HSK',
    'hsk 1',
    'hsk 2',
    'hsk 3',
    'hsk 4',
    'luyện thi hsk online',
    'đề thi hsk',
    'ngữ pháp tiếng trung sơ cấp',
    'game học tiếng Trung',
    'game nhịp điệu tiếng Trung',
    'rhythm game tiếng Trung',
    'pvp tiếng Trung',
    'đấu từ vựng tiếng trung',
    'tiên đảo hán tự',
    'learn chinese game',
    'chinese typing game',
    'pinyin typing practice',
    'hsk vocabulary game',
  ],
  authors: [{ name: 'Hanzi Beat Team', url: 'https://hanzibeat.online' }],
  creator: 'Hanzi Beat',
  publisher: 'Hanzi Beat',
  category: 'education',
  alternates: {
    canonical: 'https://hanzibeat.online',
    languages: {
      'vi-VN': 'https://hanzibeat.online',
      'x-default': 'https://hanzibeat.online',
    },
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Hanzi Beat — Game học Hán tự nhịp điệu, xây đảo & đấu PvP',
    description:
      'Chinh phục Hán tự qua nhịp điệu sôi động! Chơi đơn xây đảo tiên, thi đấu PvP trực tiếp. Luyện gõ, nhớ mặt chữ, tăng vốn từ vựng HSK hoàn toàn miễn phí.',
    url: 'https://hanzibeat.online',
    siteName: 'Hanzi Beat',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Hanzi Beat - Game học Hán tự nhịp điệu và thi đấu PvP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hanzi Beat — Game học Hán tự nhịp điệu, xây đảo & đấu PvP',
    description:
      'Chinh phục Hán tự qua nhịp điệu sôi động! Luyện gõ Pinyin, nhớ mặt chữ HSK, đấu PvP và xây Tiên Đảo.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': 'https://hanzibeat.online/#webapp',
      name: 'Hanzi Beat',
      url: 'https://hanzibeat.online',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'All modern browsers (Web, iOS, Android, Desktop)',
      browserRequirements: 'Requires JavaScript and HTML5 Canvas support',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '1280',
        bestRating: '5',
        worstRating: '1',
      },
    },
    {
      '@type': 'VideoGame',
      '@id': 'https://hanzibeat.online/#game',
      name: 'Hanzi Beat — Game Luyện Gõ Hán Tự & Đấu PvP',
      description:
        'Game nhịp điệu học tiếng Trung, luyện phản xạ gõ Pinyin, ghi nhớ mặt chữ Hán HSK 1-4, xây đảo tiên và đấu trường PvP trực tuyến.',
      genre: ['Rhythm Game', 'Educational', 'Multiplayer PvP', 'City Building'],
      gamePlatform: ['Web Browser', 'Mobile Web', 'Desktop Web'],
      inLanguage: ['vi', 'zh-CN'],
    },
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://hanzibeat.online/#organization',
      name: 'Hanzi Beat',
      url: 'https://hanzibeat.online',
      logo: {
        '@type': 'ImageObject',
        url: 'https://hanzibeat.online/brand/hanzi-beat-logo.png',
      },
      sameAs: ['https://github.com/manhnt04/nihon-beat'],
    },
    generateFaqSchema(),
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
