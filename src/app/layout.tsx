import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import type { Metadata } from "next";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Табель — учёт рабочего времени",
  description: "Сотрудники, таймер с описанием задачи и отчёт за выбранный период.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-6 px-4 py-5">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Табель
            </Link>
            <nav aria-label="Разделы" className="flex gap-6 text-sm">
              <NavLink href="/">Сотрудники</NavLink>
              <NavLink href="/report">Отчёт</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
