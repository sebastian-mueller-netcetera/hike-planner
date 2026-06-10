import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Hike Planner",
  description: "Shared hike planning for two friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
