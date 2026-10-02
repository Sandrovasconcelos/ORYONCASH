import { chamarGemini } from "@/lib/gemini/chamarGemini";
import { sanitizarSvgInterno } from "./sanitizar";

const GEMINI_ORCAMENTO_MS = 30_000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: { svg: { type: "string" } },
  required: ["svg"],
};

function montarPrompt(nome: string): string {
  return `Desenhe um icone ilustrado, estilo flat (cores solidas, formas simples, sem contorno
grosso), que represente "${nome}" num sistema de controle financeiro de obras de
construcao civil. O desenho deve mostrar de forma clara e literal o que o nome
descreve (se for um material, o proprio material; se for uma etapa da obra, a
atividade ou o elemento construtivo).

Regras do SVG - devolva SO o conteudo interno, que sera colocado dentro de um
<svg viewBox="0 0 48 48">:
- Use apenas as tags: g, path, rect, circle, ellipse, line, polygon, polyline.
- Atributos permitidos: d, fill, stroke, stroke-width, stroke-linecap,
  stroke-linejoin, x, y, cx, cy, r, rx, ry, width, height, x1, y1, x2, y2,
  points, transform, opacity.
- Cores em hexadecimal (#RRGGBB). Nada de gradientes, url(), texto, imagens,
  estilos ou scripts.
- Ocupe bem a area 0..48 com margem de uns 4 pontos, fundo transparente.
- Entre 4 e 14 formas.

Exemplo de estilo (saco de cimento):
<path d="M13 9h22l4 6-1.5 25a2 2 0 0 1-2 1.9H12.5a2 2 0 0 1-2-1.9L9 15z" fill="#D5D9DE"/><path d="M13 9h22l4 6H9z" fill="#B3BAC2"/><rect x="14" y="20" width="20" height="14" rx="2.5" fill="#2F6FB3"/><rect x="17" y="24" width="14" height="2.4" rx="1.2" fill="#fff"/>

Responda em JSON: {"svg": "<conteudo interno>"}.`;
}

/** Pede pro Gemini desenhar o icone e so devolve se o SVG passar na validacao. */
export async function gerarIconeSvgComIA(nome: string): Promise<string | null> {
  try {
    const res = await chamarGemini(
      {
        contents: [{ parts: [{ text: montarPrompt(nome) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      },
      { orcamentoMs: GEMINI_ORCAMENTO_MS, contexto: "desenhar icone" }
    );
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const { svg } = JSON.parse(text) as { svg?: string };
    return svg ? sanitizarSvgInterno(svg) : null;
  } catch (error) {
    console.error("Erro ao desenhar icone com IA:", error);
    return null;
  }
}
