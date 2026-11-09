import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Encabezado from "@/components/Encabezado";
import BarraCarga from "@/components/ui/BarraCarga";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Todas las páginas dependen de la sesión del usuario: nunca generarlas como estáticas.
export const dynamic = "force-dynamic";

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
    // suppressHydrationWarning: extensiones como LanguageTool o Grammarly modifican <html> y causan avisos falsos.
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${geistMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <Suspense>
          <BarraCarga />
        </Suspense>
        <Encabezado />
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="py-6 text-center text-xs text-slate-400">TypeLake · Concurso de Mecanografía</footer>
      </body>
    </html>
  );
}
