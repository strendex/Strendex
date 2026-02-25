import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#020203] text-white">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}