"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

type PageMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

const PAGE_LABELS: Record<string, PageMeta> = {
  "/dashboard": {
    eyebrow: "Visão geral",
    title: "Dashboard financeiro",
    description: "Acompanhe orçamento, gastos e evolução das obras.",
  },
  "/dashboard/despesas": {
    eyebrow: "Financeiro",
    title: "Lançamentos",
    description: "Revise e acompanhe as despesas recebidas pelo WhatsApp.",
  },
  "/dashboard/obras": {
    eyebrow: "Operação",
    title: "Obras",
    description: "Gerencie projetos e seus respectivos orçamentos.",
  },
  "/dashboard/materiais": {
    eyebrow: "Cadastros",
    title: "Materiais",
    description: "Organize os materiais usados nos lançamentos.",
  },
  "/dashboard/categorias": {
    eyebrow: "Cadastros",
    title: "Categorias",
    description: "Padronize os grupos usados nos lançamentos e no WhatsApp.",
  },
  "/dashboard/fornecedores": {
    eyebrow: "Cadastros",
    title: "Fornecedores",
    description: "Mantenha os dados dos fornecedores atualizados.",
  },
  "/dashboard/atividades": {
    eyebrow: "Auditoria",
    title: "Atividades",
    description: "Consulte tudo o que foi alterado no módulo.",
  },
  "/dashboard/lixeira": {
    eyebrow: "Recuperação",
    title: "Lixeira",
    description: "Restaure itens removidos ou apague definitivamente.",
  },
  "/dashboard/numeros": {
    eyebrow: "WhatsApp",
    title: "Acessos autorizados",
    description: "Controle quem pode registrar informações pelo bot.",
  },
};

function getPageMeta(pathname: string) {
  const exact = PAGE_LABELS[pathname];
  if (exact) return exact;

  if (pathname.startsWith("/dashboard/despesas/relatorio")) {
    return {
      eyebrow: "Financeiro",
      title: "Relatório de despesas",
      description: "Resumo visual e detalhamento dos lançamentos filtrados.",
    };
  }

  const base = Object.keys(PAGE_LABELS)
    .filter((path) => path !== "/dashboard")
    .find((path) => pathname.startsWith(`${path}/`));

  if (base === "/dashboard/despesas") {
    return { ...PAGE_LABELS[base], title: "Editar lançamento" };
  }
  if (base === "/dashboard/fornecedores") {
    return { ...PAGE_LABELS[base], title: "Editar fornecedor" };
  }
  return PAGE_LABELS["/dashboard"];
}

function getPrimaryAction(pathname: string) {
  if (pathname.startsWith("/dashboard/despesas")) {
    return {
      href: "/dashboard/despesas/relatorio",
      label: "Gerar relatório",
      icon: "↧",
    };
  }

  if (pathname.startsWith("/dashboard/lixeira")) {
    return {
      href: "/dashboard/obras",
      label: "Ver obras",
      icon: "↗",
    };
  }

  return {
    href: "/dashboard/despesas",
    label: "Ver lançamentos",
    icon: "↗",
  };
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);
  const action = getPrimaryAction(pathname);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#111317] text-brand-black md:flex-row print:block print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="min-w-0 flex flex-1 flex-col bg-brand-gray-100 md:rounded-l-[26px] md:border-l md:border-white/10 print:block print:rounded-none print:border-0 print:bg-white">
        <header className="sticky top-0 z-30 border-b border-brand-gray-300/80 bg-brand-gray-100/92 backdrop-blur-xl print:hidden">
          <div className="mx-auto flex min-h-[86px] w-full max-w-[1440px] flex-col items-start justify-between gap-3 px-4 py-4 sm:min-h-[92px] sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div className="min-w-0 max-w-full">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="oc-eyebrow">OryonCash / {meta.eyebrow}</p>
                <span className="inline-flex rounded-full bg-[#e9f8f0] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-status-success">
                  WhatsApp online
                </span>
              </div>
              <h1 className="break-words font-display text-[28px] font-bold leading-none tracking-tight text-brand-black sm:truncate sm:text-3xl">
                {meta.title}
              </h1>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-brand-gray-500 sm:truncate">
                {meta.description}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Link href="/dashboard/numeros" className="oc-button oc-button-soft">
                Conexão WhatsApp
              </Link>
              <Link href={action.href} className="oc-button oc-button-dark">
                <span aria-hidden="true">{action.icon}</span>
                {action.label}
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8 print:max-w-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
