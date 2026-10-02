import { after } from "next/server";
import { svgDoIcone, rotuloDoIcone, chaveIconePorNome, normalizarNome } from "@/lib/icones/resolver";
import { carregarIconesPersonalizados, garantirIconePersonalizado } from "@/lib/icones/personalizados";

/** Ilustracao do item (material, categoria ou etapa) dentro de um quadradinho colorido. */
export function IconeTile({
  chave,
  svg,
  tamanho = 44,
  className = "",
}: {
  chave: string;
  /** SVG interno proprio (desenhado pela IA); quando vem, vale mais que a chave da biblioteca. */
  svg?: string;
  tamanho?: number;
  className?: string;
}) {
  const rotulo = rotuloDoIcone(chave);
  return (
    <span
      role="img"
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex shrink-0 items-center justify-center rounded-brand-sm bg-brand-red/10 ${className}`}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg
        viewBox="0 0 48 48"
        width={Math.round(tamanho * 0.72)}
        height={Math.round(tamanho * 0.72)}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg ?? svgDoIcone(chave) }}
      />
    </span>
  );
}

/**
 * Icone de um item pelo nome. "nomes" em ordem de prioridade (ex: material,
 * etapa, categoria) - vale o primeiro que tiver icone proprio na biblioteca
 * ou desenhado pela IA. Se nenhum tiver, "gerarPara" (categoria/etapa) entra
 * na fila pra IA desenhar um e aparece na proxima abertura da tela.
 */
export async function IconeNome({
  nomes,
  gerarPara,
  tamanho = 44,
  className,
}: {
  nomes: (string | null | undefined)[];
  gerarPara?: string | null;
  tamanho?: number;
  className?: string;
}) {
  const personalizados = await carregarIconesPersonalizados();

  for (const nome of nomes) {
    const chave = chaveIconePorNome(nome);
    if (chave !== "generico") return <IconeTile chave={chave} tamanho={tamanho} className={className} />;
    const proprio = nome ? personalizados.get(normalizarNome(nome)) : undefined;
    if (proprio) return <IconeTile chave="generico" svg={proprio} tamanho={tamanho} className={className} />;
  }

  if (gerarPara && gerarPara !== "-") {
    const nomeParaGerar = gerarPara;
    after(() => garantirIconePersonalizado(nomeParaGerar));
  }
  return <IconeTile chave="generico" tamanho={tamanho} className={className} />;
}
