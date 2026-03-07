import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "StudyFlow Concurso",
  description: "Sistema de gestao de estudos por ciclo para concursos publicos",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/studyflow-logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/studyflow-logo-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/studyflow-logo-192.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/brand/studyflow-logo-32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
