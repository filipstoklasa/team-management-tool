import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { MainNav } from "@/components/main-nav";
import "./globals.css";

/**
 * §10.5 / §10.6 — nothing in this app may be prerendered at build time.
 *
 * Every page is a live view of a local database. A statically generated page
 * would serve allocation figures frozen at build time, and for Module B it
 * would additionally bake 1:1 note content into `.next/server/app/`, which is
 * exactly the second copy outside people.db that §9.2 forbids.
 *
 * Declared once at the root so it covers every segment beneath it, rather than
 * relying on each route happening to read a dynamic API.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Management",
  description: "Allocation and people management. Local only.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider delayDuration={200}>
            <MainNav />
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </main>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
