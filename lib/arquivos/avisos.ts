import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacao, numeroNotificacao } from "@/lib/alertas/notificar";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { caminhoDoArquivo } from "./tipos";
import { diasParaVencer, formatarDataBR, textoDaValidade } from "./validade";

type Pendente = {
  id: string;
  nome: string;
  validade: string;
  avisar_dias_antes: number;
  aviso_antecipado_em: string | null;
  aviso_vencimento_em: string | null;
  area: "obra" | "licitacao" | "empresa" | "pessoal";
  pasta: string | null;
  tipo: string;
  obras: { nome: string } | null;
};

export type AvisoDeValidade = { id: string; nome: string; caminho: string; texto: string; marca: "antecipado" | "vencimento" };

/**
 * Quais arquivos precisam de aviso hoje (puro, pra testar):
 *  - "antecipado": faltam <= avisar_dias_antes dias e ainda nao avisou;
 *  - "vencimento": venceu (ou vence hoje) e ainda nao avisou disso.
 * Um arquivo ja vencido que nunca foi avisado recebe so o aviso de vencimento.
 */
export function avisosDoDia(arquivos: Pendente[], hoje: string): AvisoDeValidade[] {
  const avisos: AvisoDeValidade[] = [];
  for (const a of arquivos) {
    const dias = diasParaVencer(a.validade, hoje);
    const caminho = caminhoDoArquivo({ area: a.area, pastaNome: a.area === "obra" ? (a.obras?.nome ?? null) : a.pasta, tipo: a.tipo });
    const base = { id: a.id, nome: a.nome, caminho };
    if (dias <= 0 && !a.aviso_vencimento_em) {
      avisos.push({ ...base, marca: "vencimento", texto: textoDaValidade(a.validade, hoje) });
    } else if (dias > 0 && dias <= a.avisar_dias_antes && !a.aviso_antecipado_em) {
      avisos.push({ ...base, marca: "antecipado", texto: `${textoDaValidade(a.validade, hoje)} (${formatarDataBR(a.validade)})` });
    }
  }
  return avisos.sort((x, y) => x.texto.localeCompare(y.texto));
}

export function mensagemDeAvisos(avisos: AvisoDeValidade[]): string {
  const venceu = avisos.filter((a) => a.marca === "vencimento");
  const vencendo = avisos.filter((a) => a.marca === "antecipado");
  const bloco = (titulo: string, itens: AvisoDeValidade[]) =>
    itens.length === 0 ? "" : `${titulo}\n${itens.map((a) => `• *${a.nome}* — ${a.texto}\n   ${a.caminho}`).join("\n")}`;
  return ["📅 Documentos com prazo", bloco("⚠️ Vencidos ou vencendo hoje:", venceu), bloco("⏰ Vencendo em breve:", vencendo), 'Pra receber o arquivo, é só pedir: "manda o ..."']
    .filter(Boolean)
    .join("\n\n");
}

/** Roda uma vez por dia (junto do aviso diario). Avisa o dono dos documentos que vencem. */
export async function enviarAvisosDeValidade(): Promise<{ avisados: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("arquivos")
    .select("id, nome, validade, avisar_dias_antes, aviso_antecipado_em, aviso_vencimento_em, area, pasta, tipo, obras(nome)")
    .not("validade", "is", null)
    .order("validade")
    .limit(1000);

  const avisos = avisosDoDia((data ?? []) as unknown as Pendente[], hojeNoBrasil());
  if (avisos.length === 0) return { avisados: 0 };

  const numero = await numeroNotificacao();
  if (!numero) return { avisados: 0 };
  await enviarNotificacao(numero, mensagemDeAvisos(avisos));

  const agora = new Date().toISOString();
  const antecipados = avisos.filter((a) => a.marca === "antecipado").map((a) => a.id);
  const vencidos = avisos.filter((a) => a.marca === "vencimento").map((a) => a.id);
  if (antecipados.length) await supabase.from("arquivos").update({ aviso_antecipado_em: agora }).in("id", antecipados);
  // Quem venceu sem aviso antecipado tambem conta como avisado.
  if (vencidos.length) await supabase.from("arquivos").update({ aviso_vencimento_em: agora, aviso_antecipado_em: agora }).in("id", vencidos);
  return { avisados: avisos.length };
}
