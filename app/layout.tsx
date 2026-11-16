import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeRide EDU AI 2026 | Thế giới 3D An toàn Giao thông Học đường Việt Nam',
  description: 'Trò chơi giáo dục thực tế ảo 3D rèn luyện kỹ năng tham gia giao thông an toàn dành cho học sinh THCS & THPT Việt Nam.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-512x512.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,500;0,600;0,700;0,800;1,700&family=Nunito:wght@600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
