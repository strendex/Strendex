import type { Metadata } from "next";
import "./globals.css";

// This part controls the App Icon and the Browser Tab Title
export const metadata: Metadata = {
  title: "STRENDEX",
  description: "Global Athlete Rankings",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Strendex",
  },
  icons: {
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}