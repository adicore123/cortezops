import type { Metadata } from "next";
import { Heebo, Chakra_Petch } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["italic", "normal"],
});

/* הפונט הביתי של קורטז — כמו באתר */
const birzia = localFont({
  variable: "--font-birzia",
  src: [
    { path: "../../public/brand/fonts/Birzia-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/brand/fonts/Birzia-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/brand/fonts/Birzia-Black.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
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
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${chakra.variable} ${birzia.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
