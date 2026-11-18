import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["100", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "קורטז — מערכת תפעול",
    template: "%s · קורטז",
  },
  description: "מערכת תפעול פנימית ליבואן: תיקי מכון התקנים, מאגר דגמים, מלאי חלפים וקריאות שירות",
  icons: { icon: "/brand/favicon-192.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
