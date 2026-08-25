import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "backups";
const MANTER_ULTIMOS = 14;

/**
 * Backup logico (nao e um pg_dump binario) - varre cada tabela via
 * supabase-js e salva o conteudo como JSON dentro de um zip. Existe porque
 * o plano Free do Supabase nao inclui backup automatico nenhum; isso da
 * uma rede de seguranca minima sem custo, guardada num bucket separado do
 * banco (sobrevive a um DELETE ou DROP TABLE por engano).
 */
const TABELAS = [
  "obras",
  "categorias",
  "etapas",
  "etapa_distribuicao_mensal",
  "materiais",
  "fornecedores",
  "despesas",
  "contas_bancarias",
  "despesa_comprovantes",
  "whatsapp_sessions",
  "usuarios_whatsapp",
  "whatsapp_mensagens_processadas",
  "configuracoes_notificacao",
  "atividades",
  "checklist_templates",
  "checklist_itens",
  "inspecoes",
  "inspecao_respostas",
  "inspecao_evidencias",
  "medicoes",
  "medicao_itens",
  "cronograma_templates",
  "cronograma_template_fases",
  "cronograma_template_atividades",
  "obra_cronograma_fases",
  "obra_cronograma_atividades",
  "contratos_fornecedor",
  "orcamento_material_etapa",
] as const;

export interface ResultadoBackup {
  arquivo: string;
  tabelas: number;
  linhasTotal: number;
  removidos: string[];
  erros: string[];
}

export async function gerarEEnviarBackup(): Promise<ResultadoBackup> {
  const supabase = createAdminClient();
  const zip = new JSZip();
  const erros: string[] = [];
  let linhasTotal = 0;

  for (const tabela of TABELAS) {
    const { data, error } = await supabase.from(tabela).select("*");
    if (error) {
      erros.push(`${tabela}: ${error.message}`);
      continue;
    }
    linhasTotal += data?.length ?? 0;
    zip.file(`${tabela}.json`, JSON.stringify(data ?? [], null, 2));
  }

  const conteudo = await zip.generateAsync({ type: "nodebuffer" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const arquivo = `backup-${timestamp}.zip`;

  await garantirBucket(supabase);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(arquivo, conteudo, { contentType: "application/zip" });
  if (uploadError) {
    erros.push(`upload: ${uploadError.message}`);
  }

  const removidos = await limparBackupsAntigos(supabase);

  return { arquivo, tabelas: TABELAS.length, linhasTotal, removidos, erros };
}

async function garantirBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await supabase.storage.createBucket(BUCKET, { public: false });
}

async function limparBackupsAntigos(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const { data: arquivos } = await supabase.storage.from(BUCKET).list("", {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (!arquivos || arquivos.length <= MANTER_ULTIMOS) return [];

  const antigos = arquivos.slice(MANTER_ULTIMOS).map((a) => a.name);
  if (antigos.length === 0) return [];

  await supabase.storage.from(BUCKET).remove(antigos);
  return antigos;
}
