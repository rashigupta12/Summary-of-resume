
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SnapSum",
  description: "SnapSum - Summarize your PDFs with AI",
  openGraph: {
    title: "SnapSum",
    description: "SnapSum - Summarize your PDFs with AI",
    url: "https://snapcv-kohl.vercel.app/",
    siteName: "SnapSum",
    images: [
      {
        url: "https://gojf7j54p4.ufs.sh/f/CcC11ljtXd0c5L0Ch2EoHV6KuzLAEMekUxlpn9y4f2c7sGdB",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
