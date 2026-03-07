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
  description: "Sistema de gestão de estudos por ciclo para concursos públicos",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/studyflow-logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/brand/studyflow-logo.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/brand/studyflow-logo.png",
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
