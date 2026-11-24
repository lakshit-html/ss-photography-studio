import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SS Photography — Luxury Wedding Photography & AI Photo Delivery',
  description:
    'Award-winning cinematic luxury wedding photography by SS Photography. High-speed Nikon D750 tethered capture and smart AI face recognition photo discovery for wedding guests.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col bg-[#FAF8F5] text-[#1A1918]">
        {children}
      </body>
    </html>
  );
}
