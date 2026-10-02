import type { IconeMaterial } from "./materiais";

// Ilustracoes extras (viewBox 0 0 48 48) para categorias e etapas de obra.
export const ICONES_ETAPA: Record<string, IconeMaterial> = {
  topografia: {
    rotulo: "Topografia",
    svg: `<path d="M24 20L14 43M24 20L34 43M24 20v23" stroke="#6B7280" stroke-width="2.5" stroke-linecap="round"/>
<rect x="16" y="8" width="16" height="12" rx="2.5" fill="#F5B820"/>
<circle cx="24" cy="14" r="3.6" fill="#374151"/><circle cx="24" cy="14" r="1.4" fill="#9CA3AF"/>
<rect x="31" y="11.5" width="6" height="5" rx="1.2" fill="#9CA3AF"/>`,
  },
  terraplenagem: {
    rotulo: "Terraplenagem",
    svg: `<path d="M3 41C10 41 14 24 24 22S38 41 45 41Z" fill="#9A6B3F"/>
<path d="M24 22C38 24 38 41 45 41L32 41C32 32 29 25 24 22Z" fill="#7C5230"/>
<rect x="36" y="6" width="3.4" height="20" rx="1.4" fill="#B9763A"/>
<path d="M31.5 26h12l-2 9h-8z" fill="#9CA3AF"/>`,
  },
  fundacao: {
    rotulo: "Fundação",
    svg: `<rect x="4" y="35" width="40" height="9" rx="2" fill="#9A6B3F"/>
<rect x="8" y="28" width="32" height="8" rx="1.5" fill="#AEB5BD"/>
<rect x="19" y="7" width="10" height="22" fill="#CBD0D6"/>
<path d="M21.5 9v18M26.5 9v18" stroke="#E0662F" stroke-width="1.5"/>`,
  },
  estrutura: {
    rotulo: "Estrutura (pilar e viga)",
    svg: `<rect x="6" y="9" width="36" height="8" rx="1.5" fill="#CBD0D6"/>
<rect x="9" y="17" width="8" height="25" fill="#B8BEC5"/>
<rect x="31" y="17" width="8" height="25" fill="#B8BEC5"/>
<rect x="6" y="9" width="36" height="3" fill="#E4E7EB"/>
<path d="M12 20v19M35 20v19" stroke="#E0662F" stroke-width="1.4"/>`,
  },
  cobertura: {
    rotulo: "Cobertura / telhado",
    svg: `<path d="M3 26L24 7l21 19z" fill="#C9502C"/>
<path d="M9 25h30M13 20h22M17 15h14" stroke="#E07050" stroke-width="1.6" stroke-linecap="round"/>
<rect x="9" y="26" width="30" height="15" fill="#F1E3D3"/>
<rect x="20" y="31" width="8" height="10" rx="1" fill="#B9763A"/>`,
  },
  esquadria: {
    rotulo: "Esquadrias / portas",
    svg: `<rect x="12" y="5" width="24" height="38" rx="2" fill="#8D6E4F"/>
<rect x="16" y="9" width="16" height="13" rx="1.2" fill="#BFE3F7"/>
<rect x="16" y="26" width="16" height="13" rx="1.2" fill="#7A5C3F"/>
<circle cx="31" cy="25" r="1.8" fill="#F5B820"/>`,
  },
  loucas: {
    rotulo: "Louças e metais",
    svg: `<path d="M9 22h18a6 6 0 0 1 6 6v2" fill="none" stroke="#9CA3AF" stroke-width="5" stroke-linecap="round"/>
<rect x="6" y="18" width="8" height="8" rx="2" fill="#6B7280"/>
<path d="M33 36c0 0-3 3.4-3 5.2a3 3 0 0 0 6 0c0-1.8-3-5.2-3-5.2z" fill="#4DA3F0"/>
<path d="M6 44h36" stroke="#E4E7EB" stroke-width="3" stroke-linecap="round"/>`,
  },
  piscina: {
    rotulo: "Piscina",
    svg: `<rect x="5" y="22" width="38" height="19" rx="4" fill="#4DB6F0"/>
<path d="M9 30q3-3 6 0t6 0t6 0t6 0t6 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
<path d="M14 24V12a3 3 0 0 1 6 0M23 24V12a3 3 0 0 1 6 0" fill="none" stroke="#C9CED6" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  pintura: {
    rotulo: "Pintura",
    svg: `<rect x="6" y="8" width="30" height="12" rx="3.5" fill="#E45B4A"/>
<path d="M36 14h3a3 3 0 0 1 3 3v6H24v7" fill="none" stroke="#6B7280" stroke-width="2.4" stroke-linejoin="round"/>
<rect x="21" y="30" width="6" height="13" rx="2" fill="#B9763A"/>
<path d="M10 12h12" stroke="#fff" opacity=".5" stroke-width="2" stroke-linecap="round"/>`,
  },
  piso: {
    rotulo: "Pisos",
    svg: `<path d="M5 24v4l19 10 19-10v-4" fill="#C9C2B4"/>
<path d="M5 24l19-10 19 10-19 10z" fill="#E7E2D8"/>
<path d="M14.5 29L33.5 19M14.5 19L33.5 29" stroke="#C9C2B4" stroke-width="1.6"/>`,
  },
  revestimento: {
    rotulo: "Revestimentos / azulejo",
    svg: `<rect x="6" y="6" width="36" height="36" rx="3" fill="#fff"/>
<g fill="#CFE3F5" stroke="#8EB6DB" stroke-width="1.4">
<rect x="8" y="8" width="10.5" height="10.5" rx="1.5"/><rect x="18.8" y="8" width="10.5" height="10.5" rx="1.5"/><rect x="29.5" y="8" width="10.5" height="10.5" rx="1.5"/>
<rect x="8" y="18.8" width="10.5" height="10.5" rx="1.5"/><rect x="18.8" y="18.8" width="10.5" height="10.5" rx="1.5"/><rect x="29.5" y="18.8" width="10.5" height="10.5" rx="1.5"/>
<rect x="8" y="29.5" width="10.5" height="10.5" rx="1.5"/><rect x="18.8" y="29.5" width="10.5" height="10.5" rx="1.5"/><rect x="29.5" y="29.5" width="10.5" height="10.5" rx="1.5"/></g>`,
  },
  drenagem: {
    rotulo: "Drenagem",
    svg: `<rect x="4" y="12" width="40" height="14" rx="7" fill="#374151"/>
<path d="M12 12v14M18 12v14M24 12v14M30 12v14M36 12v14" stroke="#5B6572" stroke-width="2"/>
<path d="M15 31c0 0-3.4 4-3.4 6.2a3.4 3.4 0 0 0 6.8 0C18.4 35 15 31 15 31z" fill="#4DA3F0"/>
<path d="M33 31c0 0-3.4 4-3.4 6.2a3.4 3.4 0 0 0 6.8 0C36.4 35 33 31 33 31z" fill="#4DA3F0"/>`,
  },
  limpeza: {
    rotulo: "Limpeza",
    svg: `<g transform="rotate(28 24 24)">
<rect x="22" y="2" width="4" height="26" rx="2" fill="#B9763A"/>
<path d="M13 28h22l3 15H10z" fill="#F5B820"/>
<path d="M16 32l-1 11M21 32v11M27 32v11M32 32l1 11" stroke="#E09F10" stroke-width="1.6"/>
</g>`,
  },
  canteiro: {
    rotulo: "Canteiro / mobilização",
    svg: `<path d="M24 5l10 33H14z" fill="#F57C20"/>
<path d="M19.5 20h9l-1.6-5.4h-5.8z" fill="#fff"/>
<path d="M16.5 30h15l-1.5-5h-12z" fill="#fff"/>
<rect x="8" y="38" width="32" height="5" rx="2" fill="#4B5563"/>`,
  },
  calendario: {
    rotulo: "Etapa do cronograma (mês)",
    svg: `<rect x="7" y="9" width="34" height="32" rx="4" fill="#fff" stroke="#CBD5E1" stroke-width="2"/>
<path d="M11 13a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2v6H11z" fill="#E45B4A"/>
<rect x="14" y="5" width="3.4" height="8" rx="1.7" fill="#6B7280"/><rect x="30.6" y="5" width="3.4" height="8" rx="1.7" fill="#6B7280"/>
<g fill="#CBD5E1"><circle cx="15" cy="26" r="2"/><circle cx="24" cy="26" r="2"/><circle cx="33" cy="26" r="2"/>
<circle cx="15" cy="34" r="2"/><circle cx="24" cy="34" r="2" fill="#E45B4A"/><circle cx="33" cy="34" r="2"/></g>`,
  },
  chave: {
    rotulo: "Entrega final",
    svg: `<circle cx="14" cy="24" r="9" fill="#F5B820" stroke="#E09F10" stroke-width="2"/>
<circle cx="14" cy="24" r="3.4" fill="#fff"/>
<rect x="22" y="21.5" width="21" height="5.5" rx="1.8" fill="#F5B820"/>
<rect x="33" y="27" width="4" height="7" rx="1.2" fill="#F5B820"/>
<rect x="39" y="27" width="4" height="5" rx="1.2" fill="#F5B820"/>`,
  },
  olho: {
    rotulo: "Admiração / visita de obra",
    svg: `<path d="M3 24C10 12 38 12 45 24 38 36 10 36 3 24z" fill="#fff" stroke="#6B7280" stroke-width="2.5" stroke-linejoin="round"/>
<circle cx="24" cy="24" r="7.5" fill="#2F6FB3"/><circle cx="24" cy="24" r="3.2" fill="#111827"/>
<circle cx="26.5" cy="21.5" r="1.4" fill="#fff"/>`,
  },
  betoneira: {
    rotulo: "Equipamentos / betoneira",
    svg: `<g transform="rotate(-18 24 20)"><path d="M11 8h26l-4 22H15z" fill="#F57C20"/>
<path d="M13 16h22M14 23h20" stroke="#fff" opacity=".55" stroke-width="2"/>
<ellipse cx="24" cy="8" rx="13" ry="3.2" fill="#C9650F"/></g>
<path d="M17 34l-5 9M31 34l5 9" stroke="#4B5563" stroke-width="3" stroke-linecap="round"/>
<circle cx="11" cy="43" r="3" fill="#374151"/><circle cx="37" cy="43" r="3" fill="#374151"/>`,
  },
  servicos: {
    rotulo: "Serviços / geral",
    svg: `<rect x="6" y="14" width="36" height="26" rx="4" fill="#CBD5E1"/>
<path d="M17 14v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" fill="none" stroke="#64748B" stroke-width="2.6"/>
<rect x="6" y="24" width="36" height="4" fill="#94A3B8"/><rect x="21" y="22" width="6" height="8" rx="1.4" fill="#F5B820"/>`,
  },
  generico: {
    rotulo: "Outros",
    svg: `<path d="M8 10a3 3 0 0 1 3-3h13.5a3 3 0 0 1 2.1.9l14 14a3 3 0 0 1 0 4.2L28.2 40.2a3 3 0 0 1-4.2 0L10 26.2a3 3 0 0 1-.9-2.1z" fill="#CBD5E1"/>
<circle cx="17" cy="17" r="3.4" fill="#fff"/>`,
  },
};
