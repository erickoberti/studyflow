import type { Metadata, Viewport } from "next";
import { Inter, Lexend, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  applicationName: "StudyFlow",
  title: { default: "StudyFlow", template: "%s | StudyFlow" },
  description: "Sistema de gestão de ciclos de estudos com foco em evolução contínua",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/studyflow-logo-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/brand/studyflow-logo-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/brand/studyflow-logo.png",
  },
  appleWebApp: { capable: true, title: "StudyFlow", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#895af6", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body className={`${lexend.variable} ${inter.variable} ${jakarta.variable} font-sans antialiased`}><Providers>{children}</Providers></body></html>;
}

