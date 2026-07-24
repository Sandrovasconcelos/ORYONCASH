import Link from "next/link";
import { signOutAction } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/obras", label: "Obras" },
  { href: "/dashboard/materiais", label: "Materiais" },
  { href: "/dashboard/fornecedores", label: "Fornecedores" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              OryonCash
            </span>
            <nav className="flex gap-5 text-sm text-zinc-600 dark:text-zinc-400">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
