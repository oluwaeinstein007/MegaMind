import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/lib/theme-provider';

// Use system font stack instead of Google Fonts to avoid network issues during build
const fontClass = 'font-sans';

export const metadata: Metadata = {
  title: 'TravelMind - AI-Powered Travel Planning',
  description: 'Multi-agent travel orchestration engine powered by AI with Redis background processing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={fontClass}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}