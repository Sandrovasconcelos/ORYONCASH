// O SVG gerado pela IA vai direto pra tela (innerHTML), entao so passa o que
// reconhecemos: tags e atributos de desenho simples, nada de script, link,
// estilo ou referencia externa.

const TAGS = new Set(["g", "path", "rect", "circle", "ellipse", "line", "polygon", "polyline"]);
const ATRIBUTOS = new Set([
  "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "x", "y", "cx", "cy", "r", "rx", "ry", "width", "height", "x1", "y1", "x2", "y2",
  "points", "transform", "opacity", "fill-opacity", "stroke-opacity",
]);
const VALOR_SEGURO = /^[#a-zA-Z0-9\s.,\-+()%]*$/;
const TAMANHO_MAXIMO = 6000;

export function sanitizarSvgInterno(bruto: string): string | null {
  const svg = bruto
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<\/?svg[^>]*>/gi, "")
    .replace(/```(?:svg|xml)?/gi, "")
    .trim();
  if (!svg || svg.length > TAMANHO_MAXIMO) return null;

  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*?)(\/?)>/g;
  let achouDesenho = false;
  let resto = svg;
  let m: RegExpExecArray | null;

  while ((m = tag.exec(svg)) !== null) {
    const [inteira, fecha, nome, atributos] = m;
    resto = resto.replace(inteira, "");
    if (!TAGS.has(nome.toLowerCase())) return null;
    if (fecha) continue;
    if (nome.toLowerCase() !== "g") achouDesenho = true;

    const padrao = /\s+([a-zA-Z-]+)="([^"]*)"/g;
    let semAtributos = atributos;
    let a: RegExpExecArray | null;
    while ((a = padrao.exec(atributos)) !== null) {
      semAtributos = semAtributos.replace(a[0], "");
      if (!ATRIBUTOS.has(a[1])) return null;
      if (!VALOR_SEGURO.test(a[2]) || /url\(|javascript|data:/i.test(a[2])) return null;
    }
    if (semAtributos.trim() !== "") return null;
  }

  if (resto.trim() !== "" || !achouDesenho) return null;
  return svg;
}
