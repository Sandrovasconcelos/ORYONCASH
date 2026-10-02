import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveIconePorNome, normalizarNome } from "./resolver";
import { gerarIconeSvgComIA } from "./gerar";

/** nome normalizado -> SVG interno desenhado pela IA. Tabela ausente (migration nao aplicada) = mapa vazio. */
export const carregarIconesPersonalizados = cache(async (): Promise<Map<string, string>> => {
  const mapa = new Map<string, string>();
  try {
    const { data, error } = await createAdminClient().from("icones_personalizados").select("nome_normalizado, svg");
    if (error) return mapa;
    for (const linha of data ?? []) mapa.set(linha.nome_normalizado, linha.svg);
  } catch {
    // sem tabela / sem rede: segue com os icones da biblioteca
  }
  return mapa;
});

// Evita pedir de novo pra IA, a cada abertura de tela, um nome que ela nao
// conseguiu desenhar - tenta de novo depois de um tempo.
const TENTATIVAS = new Map<string, number>();
const ESPERA_ENTRE_TENTATIVAS_MS = 30 * 60_000;

/**
 * Se o nome nao se encaixa em nenhum icone da biblioteca e ainda nao tem um
 * desenhado, pede pra IA desenhar e guarda. Roda em segundo plano (after).
 */
export async function garantirIconePersonalizado(nome: string): Promise<void> {
  if (chaveIconePorNome(nome) !== "generico") return;
  const chave = normalizarNome(nome);
  if (chave.length < 3) return;

  const ultima = TENTATIVAS.get(chave);
  if (ultima && Date.now() - ultima < ESPERA_ENTRE_TENTATIVAS_MS) return;
  TENTATIVAS.set(chave, Date.now());

  try {
    const supabase = createAdminClient();
    const { data: existente, error } = await supabase
      .from("icones_personalizados")
      .select("nome_normalizado")
      .eq("nome_normalizado", chave)
      .maybeSingle();
    if (error || existente) return;

    const svg = await gerarIconeSvgComIA(nome);
    if (!svg) return;

    await supabase
      .from("icones_personalizados")
      .upsert({ nome_normalizado: chave, nome, svg }, { onConflict: "nome_normalizado", ignoreDuplicates: true });
  } catch (error) {
    console.error("Erro ao criar icone personalizado:", error);
  }
}
