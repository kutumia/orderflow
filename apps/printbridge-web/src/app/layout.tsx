import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PrintBridge | Cloud Thermal Printing API',
  description: 'The universal, hardware-agnostic REST API for cloud thermal receipt printing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
