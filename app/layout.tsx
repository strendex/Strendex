import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "STRENDEX",
  description: "Hybrid athlete benchmarking and scoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#020203] text-white antialiased">
        {/* Background polish */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[#020203]" />
          {/* subtle vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(223,255,0,0.07),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.04),transparent_60%)]" />
        </div>

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