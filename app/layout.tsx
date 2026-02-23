import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050505] antialiased">
        {/* GLOBAL NAVIGATION BAR */}
        <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-black tracking-tighter text-xl text-white hover:text-emerald-500 transition-colors">
              STRENDEX <span className="text-emerald-500">HQ</span>
            </Link>
            
            <div className="flex gap-8 text-[10px] font-bold tracking-[0.2em] uppercase">
              <Link href="/score" className="text-slate-400 hover:text-white transition-colors">Calculator</Link>
              <Link href="/leaderboard" className="text-slate-400 hover:text-white transition-colors">Leaderboard</Link>
            </div>
          </div>
        </nav>

        {/* THIS IS WHERE YOUR PAGES APPEAR */}
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}