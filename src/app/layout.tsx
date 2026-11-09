import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Encabezado from "@/components/Encabezado";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TypeLake - Concurso de Mecanografía",
  description: "Prueba de mecanografía en español",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <Encabezado />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
