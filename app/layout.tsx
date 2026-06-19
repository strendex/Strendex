import "./globals.css";
import { Anton, Inter } from "next/font/google";
import Header from "../components/Header";
import Footer from "../components/Footer";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "STRENDEX",
  description: "Hybrid athlete benchmarking and scoring.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-base text-ink antialiased">
        {/* Flat base — no vignette or glow */}
        <div className="pointer-events-none fixed inset-0 -z-10 bg-base" />

        <div className="flex min-h-screen flex-col">
          <Header />

          {/* Main shell */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
              {/* consistent vertical rhythm */}
              <div className="py-8 sm:py-10 lg:py-12">{children}</div>
            </div>
          </main>

          <Footer />
        </div>
      </body>
    </html>
  );
}