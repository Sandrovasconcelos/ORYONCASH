import { formatarDataBR, situacaoDaValidade, textoDaValidade } from "@/lib/arquivos/validade";

/** Etiqueta de validade (sem validade, ok, vencendo, vencido). Funciona no servidor e no navegador. */
export function BadgeValidade({ validade, avisar, hoje }: { validade: string | null; avisar: number; hoje: string }) {
  if (!validade) return <span className="rounded-brand-sm bg-brand-gray-100 px-2 py-0.5 text-[11px] font-semibold text-brand-gray-500">sem validade</span>;
  const situacao = situacaoDaValidade(validade, hoje, avisar);
  const cor =
    situacao === "vencido"
      ? "bg-status-danger/10 text-status-danger"
      : situacao === "vencendo"
        ? "bg-status-warning/10 text-status-warning"
        : "bg-brand-gray-100 text-brand-gray-700";
  return (
    <span className={`whitespace-nowrap rounded-brand-sm px-2 py-0.5 text-[11px] font-bold ${cor}`} title={`Validade ${formatarDataBR(validade)}`}>
      {situacao === "ok" ? `vence ${formatarDataBR(validade)}` : textoDaValidade(validade, hoje)}
    </span>
  );
}

export function rotuloDoFormato(mime: string | null, nomeArquivo: string | null): string {
  const m = (mime ?? "").toLowerCase();
  const ext = nomeArquivo?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (m.startsWith("image/")) return "IMG";
  if (m.startsWith("video/")) return "VÍD";
  if (ext === "dwg" || ext === "dxf") return "DWG";
  if (m.includes("word") || ext === "doc" || ext === "docx") return "DOC";
  if (m.includes("sheet") || m.includes("excel") || ext === "xls" || ext === "xlsx") return "XLS";
  if (ext === "zip") return "ZIP";
  return (ext ?? "ARQ").toUpperCase().slice(0, 4);
}

export function IconePasta({ cheia, grande }: { cheia: boolean; grande: boolean }) {
  const tamanho = grande ? 44 : 36;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        d="M4 12a4 4 0 0 1 4-4h10l4 5h18a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12Z"
        fill={cheia ? "#f6c453" : "#e4e4e7"}
        stroke={cheia ? "#c9962a" : "#a1a1aa"}
        strokeWidth="1.5"
      />
      <path d="M4 18h40v1H4z" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}
