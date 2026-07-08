import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Voice Unlock - LASUASA',
  description: 'Secure voice-based device unlock for LASUASA Elections',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Voice Unlock',
  },
  formatDetection: {
    telephone: false,
  },
  icons: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%231a4d2e" width="192" height="192"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="100" fill="%23C9A84C" font-family="Arial">🎤</text></svg>',
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1a4d2e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Voice Unlock" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect fill='%231a4d2e' width='180' height='180'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='90' fill='%23C9A84C' font-family='Arial'>🎤</text></svg>" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
