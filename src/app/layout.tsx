import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CartWise Stockholm — Hitta billigaste matkorgen",
  description:
    "Jämför matpriser, veckans erbjudanden och resekostnader mellan butiker i Stockholm. Optimera din matkorg med CartWise.",
  keywords: [
    "matpriser",
    "Stockholm",
    "grocery",
    "jämför",
    "erbjudanden",
    "matkorg",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1a56db",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className="min-h-screen bg-background font-sans">
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <a href="/" className="flex items-center gap-2 font-semibold">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-primary"
                >
                  <rect
                    width="28"
                    height="28"
                    rx="6"
                    fill="currentColor"
                    fillOpacity="0.1"
                  />
                  <path
                    d="M7 10L9 7H19L21 10M7 10H21M7 10V20C7 20.5523 7.44772 21 8 21H20C20.5523 21 21 20.5523 21 20V10M11 14H17M11 17H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-lg tracking-tight">
                  Cart<span className="text-primary">Wise</span>
                </span>
              </a>
              <nav className="flex items-center gap-1">
                <a
                  href="/"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Hem
                </a>
                <a
                  href="/stores"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Butiker
                </a>
                <a
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Admin
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6">
            <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground">
              <p>
                CartWise Stockholm &mdash; Prisdata uppdateras regelbundet.
                Priser kan avvika i butik.
              </p>
              <p className="mt-1">
                Avstånd beräknas som fågelvägen (Haversine). Verklig körsträcka
                kan vara längre.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
