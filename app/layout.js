import { Geist } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './providers'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata = {
  title: 'ReadLey — AI Reading Companion',
  description: 'Upload books and texts, then read with AI assistance.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
