"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { signOutAction } from "./actions";

const NAV_GROUPS = [
  {
    titulo: null,
    itens: [{ href: "/dashboard", label: "Visão geral", icon: "dashboard" }],
  },
  {
    titulo: "Obra",
    itens: [
      { href: "/dashboard/obras", label: "Obras", icon: "building" },
      { href: "/dashboard/execucao", label: "Execução", icon: "check" },
      { href: "/dashboard/cronograma", label: "Cronograma", icon: "calendar" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/dashboard/despesas", label: "Lançamentos", icon: "receipt" },
      { href: "/dashboard/categorias", label: "Categorias", icon: "tag" },
      { href: "/dashboard/materiais", label: "Materiais", icon: "box" },
      { href: "/dashboard/fornecedores", label: "Fornecedores", icon: "truck" },
      { href: "/dashboard/contas", label: "Contas bancárias", icon: "wallet" },
      { href: "/dashboard/contas-a-pagar", label: "Contas a pagar", icon: "calendar" },
      { href: "/dashboard/conciliacao", label: "Conciliação bancária", icon: "scale" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/dashboard/atividades", label: "Atividades", icon: "clock" },
      { href: "/dashboard/lixeira", label: "Lixeira", icon: "trash" },
      { href: "/dashboard/numeros", label: "Acessos WhatsApp", icon: "phone" },
      { href: "/dashboard/configuracoes", label: "Configurações", icon: "settings" },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((grupo) => grupo.itens);

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M9 21v-4h6v4M8 9h1M15 9h1M8 13h1M15 13h1" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7M12 11v10" />
      </>
    ),
    tag: (
      <>
        <path d="M20 10.5 13.5 4H5v8.5L11.5 19a2.1 2.1 0 0 0 3 0l5.5-5.5a2.1 2.1 0 0 0 0-3Z" />
        <circle cx="8.5" cy="7.5" r="1" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M16 12h3M3 10h18" />
      </>
    ),
    scale: (
      <>
        <path d="M12 3v18M7 21h10" />
        <path d="M5 7h6M13 7h6" />
        <path d="M5 7 2.5 12a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="2" />
        <path d="M10 5h4M11 18.5h2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[19px] w-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex w-full flex-col items-center justify-center text-center">
      <Image
        src="/oryoncash-simbolo-oficial.png"
        alt=""
        width={265}
        height={250}
        priority
        sizes={compact ? "34px" : "86px"}
        className={compact ? "h-8 w-9 object-contain" : "h-[86px] w-[91px] object-contain"}
      />
      <Image
        src="/oryoncash-wordmark-oficial.png"
        alt="OryonCash"
        width={726}
        height={67}
        priority
        sizes={compact ? "122px" : "222px"}
        className={compact ? "mt-1 h-auto w-[122px] object-contain" : "mt-4 h-auto w-[222px] object-contain"}
      />
      <span className={compact ? "sr-only" : "mt-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#8f949d]"}>
        Controle financeiro
      </span>
    </span>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navegacao, setNavegacao] = useState<{
    destino: string;
    origem: string;
  } | null>(null);
  const destinoPendente =
    navegacao?.origem === pathname ? navegacao.destino : null;

  useEffect(() => {
    for (const item of NAV_ITEMS) {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    }
  }, [pathname, router]);

  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {NAV_GROUPS.map((grupo) => (
        <div key={grupo.titulo ?? "principal"} className="flex flex-col gap-1">
          {grupo.titulo && (
            <p className="px-3 pb-1 pt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#666c76]">
              {grupo.titulo}
            </p>
          )}
          {grupo.itens.map((item) => {
            const ativo =
              destinoPendente === item.href ||
              (destinoPendente === null &&
                (item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href)));
            const carregando = destinoPendente === item.href && pathname !== item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={(event) => {
                  if (pathname === item.href) return;
                  event.preventDefault();
                  setNavegacao({ destino: item.href, origem: pathname });
                  onNavigate?.();
                  startTransition(() => {
                    router.push(item.href);
                  });
                }}
                aria-current={ativo ? "page" : undefined}
                aria-busy={carregando || isPending || undefined}
                className={
                  ativo
                    ? "flex min-h-11 items-center gap-3 rounded-brand-sm bg-[linear-gradient(90deg,rgba(225,27,34,.24),rgba(225,27,34,.07))] px-3 py-2 text-xs font-extrabold text-white shadow-[inset_3px_0_0_var(--brand-red)]"
                    : "flex min-h-11 items-center gap-3 rounded-brand-sm px-3 py-2 text-xs font-bold text-[#aab0b9] hover:bg-white/[.055] hover:text-white"
                }
              >
                <NavIcon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {carregando && (
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111317] px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-brand-sm text-brand-gray-300 hover:bg-white/10"
        >
          ☰
        </button>
        <div className="min-w-0 flex-1">
          <Logo compact />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-brand-gray-300 hover:text-white"
          >
            Sair
          </button>
        </form>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        aria-label="Menu principal"
        className={
          (aberto ? "translate-x-0" : "-translate-x-full") +
          " fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col gap-6 bg-[#111317] p-[17px_14px] text-white shadow-[12px_0_34px_rgba(0,0,0,.08)] transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0"
        }
      >
        <div className="hidden border-b border-white/[.08] px-2 pb-4 md:block">
          <Logo />
        </div>

        <NavLinks onNavigate={() => setAberto(false)} />

        <div className="hidden border-t border-white/[.08] pt-3 md:block">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-3 rounded-brand-sm px-3 py-2 text-left text-xs font-bold text-[#aab0b9] hover:bg-white/[.055] hover:text-white"
            >
              <span aria-hidden="true">↪</span> Encerrar sessão
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
