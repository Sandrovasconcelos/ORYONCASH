"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/despesas", label: "Despesas", icon: "🧾" },
  { href: "/dashboard/obras", label: "Obras", icon: "🏗️" },
  { href: "/dashboard/materiais", label: "Materiais", icon: "📦" },
  { href: "/dashboard/fornecedores", label: "Fornecedores", icon: "🚚" },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm text-white">
        O
      </span>
      OryonCash
    </span>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const ativo =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              ativo
                ? "flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-400"
                : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Barra superior — so em telas pequenas */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          ☰
        </button>
        <Logo />
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sair
          </button>
        </form>
      </div>

      {/* Overlay do menu mobile */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      {/* Sidebar: fixa no desktop, gaveta no mobile */}
      <aside
        className={
          (aberto ? "translate-x-0" : "-translate-x-full") +
          " fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-6 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 transition-transform md:static md:z-auto md:w-60 md:translate-x-0"
        }
      >
        <div className="hidden md:block">
          <Logo />
        </div>

        <NavLinks onNavigate={() => setAberto(false)} />

        <form action={signOutAction} className="hidden md:block">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            🚪 Sair
          </button>
        </form>
      </aside>
    </>
  );
}
