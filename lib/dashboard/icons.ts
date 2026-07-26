const CATEGORIA_ICONS: Record<string, string> = {
  material: "📦",
  "mão de obra": "👷",
  "locação de equipamentos": "🚜",
  "compra de equipamentos": "🧰",
  "despesas administrativas": "🗂️",
};

const ETAPA_ICONS: Record<string, string> = {
  fundação: "⛏️",
  "mobilização e estruturas": "🚧",
  "alvenaria de elevação": "🧱",
  cobertura: "🏠",
  "esquadrias e ferragens": "🚪",
  "instalações hidrossanitárias": "🚰",
  "instalações elétricas": "⚡",
  "revestimentos e acabamentos": "🎨",
  pintura: "🖌️",
  "entrega final": "✅",
};

export function getCategoriaIcon(nome: string): string {
  return CATEGORIA_ICONS[nome.toLowerCase()] ?? "📁";
}

export function getEtapaIcon(nome: string): string {
  return ETAPA_ICONS[nome.toLowerCase()] ?? "🏗️";
}

const MATERIAL_PALAVRAS_CHAVE: [string, string][] = [
  ["cano", "🚰"],
  ["tubo", "🚰"],
  ["cimento", "🧱"],
  ["areia", "🏖️"],
  ["brita", "🪨"],
  ["tijolo", "🧱"],
  ["bloco", "🧱"],
  ["cabo", "🔌"],
  ["fio", "🔌"],
  ["tinta", "🎨"],
  ["madeira", "🪵"],
  ["ferro", "⚙️"],
  ["aço", "⚙️"],
  ["vidro", "🪟"],
  ["porta", "🚪"],
  ["janela", "🪟"],
];

export function getMaterialIcon(nome: string): string {
  const lower = nome.toLowerCase();
  const encontrado = MATERIAL_PALAVRAS_CHAVE.find(([palavra]) =>
    lower.includes(palavra)
  );
  return encontrado?.[1] ?? "📦";
}
