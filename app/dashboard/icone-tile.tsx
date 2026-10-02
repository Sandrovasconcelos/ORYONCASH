import { svgDoIcone, rotuloDoIcone } from "@/lib/icones/resolver";

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
