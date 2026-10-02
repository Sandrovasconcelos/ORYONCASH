// Ilustracoes em SVG (viewBox 0 0 48 48) usadas como icone de cada tipo de
// lancamento. Conteudo estatico e confiavel - pode ir em dangerouslySetInnerHTML.

export type IconeMaterial = { rotulo: string; svg: string };

export const ICONES_MATERIAL: Record<string, IconeMaterial> = {
  tijolo: {
    rotulo: "Tijolo",
    svg: `<rect x="5" y="11" width="38" height="27" rx="3" fill="#EBDCC8"/>
<rect x="7" y="13" width="16" height="7" rx="1.2" fill="#D9603B"/>
<rect x="25" y="13" width="16" height="7" rx="1.2" fill="#C9502C"/>
<rect x="7" y="22" width="7" height="7" rx="1.2" fill="#C9502C"/>
<rect x="16" y="22" width="16" height="7" rx="1.2" fill="#D9603B"/>
<rect x="34" y="22" width="7" height="7" rx="1.2" fill="#C9502C"/>
<rect x="7" y="31" width="16" height="5" rx="1.2" fill="#D9603B"/>
<rect x="25" y="31" width="16" height="5" rx="1.2" fill="#C9502C"/>`,
  },
  bloco: {
    rotulo: "Bloco de concreto",
    svg: `<path d="M6 18l6-7h30l-6 7z" fill="#CDD2D8"/>
<path d="M42 11v18l-6 7V18z" fill="#8F969E"/>
<rect x="6" y="18" width="30" height="18" rx="1.5" fill="#AEB5BD"/>
<rect x="10" y="23" width="8" height="9" rx="1.5" fill="#8F969E"/>
<rect x="23" y="23" width="8" height="9" rx="1.5" fill="#8F969E"/>`,
  },
  cimento: {
    rotulo: "Cimento",
    svg: `<path d="M13 9h22l4 6-1.5 25a2 2 0 0 1-2 1.9H12.5a2 2 0 0 1-2-1.9L9 15z" fill="#D5D9DE"/>
<path d="M13 9h22l4 6H9z" fill="#B3BAC2"/>
<rect x="14" y="20" width="20" height="14" rx="2.5" fill="#2F6FB3"/>
<rect x="17" y="24" width="14" height="2.4" rx="1.2" fill="#fff"/>
<rect x="17" y="28.5" width="9" height="2.4" rx="1.2" fill="#fff" opacity=".8"/>`,
  },
  areia: {
    rotulo: "Areia",
    svg: `<ellipse cx="24" cy="39" rx="19" ry="2.5" fill="#000" opacity=".08"/>
<path d="M5 38C12 38 16 14 24 12C32 14 36 38 43 38Z" fill="#EBC96B"/>
<path d="M24 12C32 14 36 38 43 38L30 38C30 26 27 16 24 12Z" fill="#D4A24C"/>
<circle cx="20" cy="30" r="1" fill="#C28F3A"/><circle cx="26" cy="26" r="1" fill="#C28F3A"/>
<circle cx="15" cy="35" r="1" fill="#C28F3A"/><circle cx="31" cy="33" r="1" fill="#B8812E"/>
<circle cx="23" cy="20" r="1" fill="#C28F3A"/>`,
  },
  brita: {
    rotulo: "Brita / pedra",
    svg: `<polygon points="12,20 18,14 24,17 20,23 14,24" fill="#B8BEC5"/>
<polygon points="6,36 10,26 18,24 21,32 16,38" fill="#8B929A"/>
<polygon points="18,24 26,18 33,23 31,32 21,32" fill="#A7AEB6"/>
<polygon points="31,32 33,23 41,25 43,34 36,38" fill="#7A8189"/>
<polygon points="16,38 21,32 31,32 36,38" fill="#9AA1A9"/>`,
  },
  ferro: {
    rotulo: "Vergalhão / ferro",
    svg: `<g transform="rotate(-12 24 24)" stroke-linecap="round">
<line x1="6" y1="14" x2="42" y2="14" stroke="#5B6572" stroke-width="6"/>
<line x1="6" y1="24" x2="42" y2="24" stroke="#5B6572" stroke-width="6"/>
<line x1="6" y1="34" x2="42" y2="34" stroke="#5B6572" stroke-width="6"/>
<line x1="7" y1="14" x2="41" y2="14" stroke="#3F4854" stroke-width="6" stroke-dasharray="1.4 4.6"/>
<line x1="7" y1="24" x2="41" y2="24" stroke="#3F4854" stroke-width="6" stroke-dasharray="1.4 4.6"/>
<line x1="7" y1="34" x2="41" y2="34" stroke="#3F4854" stroke-width="6" stroke-dasharray="1.4 4.6"/>
<line x1="7" y1="12.2" x2="41" y2="12.2" stroke="#9AA3AE" stroke-width="1.4"/>
<line x1="7" y1="22.2" x2="41" y2="22.2" stroke="#9AA3AE" stroke-width="1.4"/>
<line x1="7" y1="32.2" x2="41" y2="32.2" stroke="#9AA3AE" stroke-width="1.4"/>
</g>`,
  },
  madeira: {
    rotulo: "Madeira",
    svg: `<rect x="5" y="10" width="38" height="9" rx="2" fill="#C98F55"/>
<rect x="5" y="20" width="38" height="9" rx="2" fill="#B87D45"/>
<rect x="5" y="30" width="38" height="9" rx="2" fill="#D49C62"/>
<path d="M9 14.5h14M28 14.5h10M9 24.5h8M22 24.5h16M9 34.5h18M31 34.5h7" stroke="#8C5A2B" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>`,
  },
  hidraulico: {
    rotulo: "Hidráulica / tubos",
    svg: `<path d="M10 12v14a10 10 0 0 0 10 10h18" fill="none" stroke="#2B5FA8" stroke-width="12"/>
<path d="M10 12v14a10 10 0 0 0 10 10h18" fill="none" stroke="#5B9BE0" stroke-width="8"/>
<rect x="4" y="7" width="12" height="5" rx="1.5" fill="#1F4A87"/>
<rect x="36" y="30" width="5" height="12" rx="1.5" fill="#1F4A87"/>`,
  },
  eletrico: {
    rotulo: "Elétrica",
    svg: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#F4F5F7" stroke="#C9CED6" stroke-width="2"/>
<circle cx="24" cy="24" r="12" fill="#fff" stroke="#DDE1E6" stroke-width="2"/>
<rect x="16.4" y="19" width="3.6" height="9" rx="1.6" fill="#374151"/>
<rect x="28" y="19" width="3.6" height="9" rx="1.6" fill="#374151"/>
<circle cx="24" cy="32" r="1.9" fill="#374151"/>`,
  },
  tinta: {
    rotulo: "Tinta",
    svg: `<path d="M12 11c0-6 24-6 24 0" fill="none" stroke="#6B7280" stroke-width="2.2"/>
<path d="M10 14h28v24a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#E5E7EB"/>
<rect x="8" y="11" width="32" height="5" rx="2.5" fill="#9CA3AF"/>
<rect x="10" y="25" width="28" height="11" fill="#E45B4A"/>
<path d="M17 16v7.5a2.5 2.5 0 0 0 5 0V16z" fill="#E45B4A"/>`,
  },
  parafuso: {
    rotulo: "Parafuso / prego",
    svg: `<g transform="rotate(35 24 24)">
<rect x="14" y="6" width="20" height="7" rx="3.5" fill="#9CA3AF"/>
<path d="M19 9.5h10" stroke="#6B7280" stroke-width="1.8" stroke-linecap="round"/>
<rect x="21" y="12" width="6" height="30" rx="2" fill="#B8BEC5"/>
<path d="M21 18h6M21 23h6M21 28h6M21 33h6" stroke="#6B7280" stroke-width="1.6"/>
</g>`,
  },
  martelo: {
    rotulo: "Ferramenta manual",
    svg: `<g transform="rotate(-40 24 24)">
<rect x="21" y="14" width="6" height="30" rx="2" fill="#B9763A"/>
<rect x="10" y="7" width="28" height="11" rx="2.5" fill="#6B7280"/>
<rect x="10" y="7" width="8" height="11" rx="2.5" fill="#4B5563"/>
</g>`,
  },
  broca: {
    rotulo: "Broca / ferramenta elétrica",
    svg: `<g transform="rotate(-45 24 24)">
<rect x="19" y="5" width="10" height="9" rx="2" fill="#6B7280"/>
<rect x="21" y="14" width="6" height="26" fill="#C9CED6"/>
<path d="M21 19l6 3M21 24l6 3M21 29l6 3M21 34l6 3" stroke="#7B828B" stroke-width="2"/>
<path d="M21 40h6l-3 5z" fill="#9AA1A9"/>
</g>`,
  },
  disco: {
    rotulo: "Disco / lixa",
    svg: `<circle cx="24" cy="24" r="17" fill="#9CA3AF"/>
<circle cx="24" cy="24" r="12.5" fill="#D1D5DB"/>
<circle cx="24" cy="24" r="4.5" fill="#6B7280"/>
<path d="M24 11.5v5M24 31.5v5M11.5 24h5M31.5 24h5" stroke="#9CA3AF" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  massa: {
    rotulo: "Massa / gesso / rejunte",
    svg: `<path d="M11 28c1-8 8-11 13-11s12 3 13 11z" fill="#F3F4F6" stroke="#D5D9DE" stroke-width="1.5"/>
<path d="M17 24c2-3 5-4 7-4" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>
<rect x="5" y="28" width="38" height="8" rx="2.5" fill="#B8BEC5"/>
<rect x="5" y="28" width="38" height="3" rx="1.5" fill="#D1D5DB"/>`,
  },
  manta: {
    rotulo: "Manta / impermeabilização",
    svg: `<ellipse cx="9" cy="25" rx="5" ry="11" fill="#2A323D"/>
<rect x="9" y="14" width="29" height="22" fill="#374151"/>
<ellipse cx="38" cy="25" rx="5" ry="11" fill="#4B5563"/>
<ellipse cx="38" cy="25" rx="2" ry="4.4" fill="#1F2937"/>
<path d="M14 18h20" stroke="#4B5563" stroke-width="2" stroke-linecap="round"/>`,
  },
  vidro: {
    rotulo: "Vidro / esquadria",
    svg: `<rect x="8" y="8" width="32" height="32" rx="3" fill="#8D6E4F"/>
<rect x="12" y="12" width="10.5" height="10.5" fill="#BFE3F7"/>
<rect x="25.5" y="12" width="10.5" height="10.5" fill="#BFE3F7"/>
<rect x="12" y="25.5" width="10.5" height="10.5" fill="#BFE3F7"/>
<rect x="25.5" y="25.5" width="10.5" height="10.5" fill="#BFE3F7"/>
<path d="M14 20l5-5M27.5 20l5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`,
  },
  laje: {
    rotulo: "Laje",
    svg: `<path d="M5 22v6l19 9v-6z" fill="#A1A8B0"/>
<path d="M43 22v6l-19 9v-6z" fill="#8A929B"/>
<path d="M5 22l19-9 19 9-19 9z" fill="#CBD0D6"/>
<path d="M11.3 25L30.3 16M17.5 28L36.5 19M11.3 19L30.3 28M17.5 16L36.5 25" stroke="#E0662F" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  maoDeObra: {
    rotulo: "Mão de obra",
    svg: `<rect x="21" y="13" width="6" height="17" rx="2" fill="#E09F10"/>
<path d="M8 30a16 16 0 0 1 32 0z" fill="#F5B820"/>
<rect x="21" y="13" width="6" height="17" rx="2" fill="#E09F10" opacity=".55"/>
<rect x="5" y="30" width="38" height="6" rx="3" fill="#E09F10"/>
<path d="M13 26a11 11 0 0 1 5-8" stroke="#fff" opacity=".55" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  },
  entulho: {
    rotulo: "Entulho / caçamba",
    svg: `<polygon points="12,16 15,10 20,12 19,16" fill="#9AA1A9"/>
<rect x="24" y="9" width="9" height="7" rx="1.2" fill="#D9603B"/>
<path d="M6 16h36l-4 20a2 2 0 0 1-2 1.6H12a2 2 0 0 1-2-1.6z" fill="#E4A11B"/>
<path d="M6 16h36v4H6z" fill="#C98A10"/>
<path d="M16 23l-1 11M24 23v12M32 23l1 11" stroke="#B87A0C" stroke-width="2" stroke-linecap="round"/>
<circle cx="15" cy="41" r="3" fill="#4B5563"/><circle cx="33" cy="41" r="3" fill="#4B5563"/>`,
  },
  refeicao: {
    rotulo: "Refeição",
    svg: `<circle cx="24" cy="25" r="11.5" fill="#F4F5F7" stroke="#D5D9DE" stroke-width="2"/>
<circle cx="24" cy="25" r="7" fill="#fff" stroke="#E4E7EB"/>
<path d="M5 9v8M7.5 9v8M10 9v8" stroke="#6B7280" stroke-width="1.6" stroke-linecap="round"/>
<path d="M5 17a2.5 2.5 0 0 0 5 0" stroke="#6B7280" stroke-width="1.6" fill="none"/>
<path d="M7.5 19.5V40" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
<path d="M39 9c4 1 5 9 5 14h-5z" fill="#9CA3AF"/>
<rect x="39" y="23" width="3.4" height="17" rx="1.4" fill="#6B7280"/>`,
  },
  luz: {
    rotulo: "Conta de luz",
    svg: `<path d="M24 6a12 12 0 0 0-6 22.4V33h12v-4.6A12 12 0 0 0 24 6z" fill="#FFD84D"/>
<path d="M22 25l2-6 2 6" stroke="#E09F10" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17 15a8 8 0 0 1 5-5" stroke="#fff" opacity=".75" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<rect x="18" y="34" width="12" height="3" rx="1.5" fill="#9CA3AF"/>
<rect x="19.5" y="38.5" width="9" height="3" rx="1.5" fill="#6B7280"/>`,
  },
  agua: {
    rotulo: "Conta de água",
    svg: `<path d="M24 5C24 5 11 20 11 29a13 13 0 0 0 26 0C37 20 24 5 24 5z" fill="#4DA3F0"/>
<path d="M17 30a7 7 0 0 0 5 6.5" stroke="#fff" opacity=".65" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  },
  internet: {
    rotulo: "Internet",
    svg: `<path d="M6 19a26 26 0 0 1 36 0" stroke="#4B6BFB" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M12 26a17 17 0 0 1 24 0" stroke="#4B6BFB" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M18 33a8 8 0 0 1 12 0" stroke="#4B6BFB" stroke-width="4" fill="none" stroke-linecap="round"/>
<circle cx="24" cy="39.5" r="3" fill="#4B6BFB"/>`,
  },
  predio: {
    rotulo: "Administrativo / aluguel",
    svg: `<rect x="10" y="9" width="28" height="32" rx="2" fill="#94A3B8"/>
<g fill="#E2E8F0"><rect x="15" y="14" width="5" height="5"/><rect x="22" y="14" width="5" height="5"/><rect x="29" y="14" width="5" height="5"/>
<rect x="15" y="22" width="5" height="5"/><rect x="22" y="22" width="5" height="5"/><rect x="29" y="22" width="5" height="5"/>
<rect x="15" y="30" width="5" height="5"/><rect x="29" y="30" width="5" height="5"/></g>
<rect x="21.5" y="31" width="5" height="10" rx="1" fill="#475569"/>`,
  },
  bandeira: {
    rotulo: "Finalização de obra",
    svg: `<rect x="9" y="6" width="3.5" height="36" rx="1.7" fill="#6B7280"/>
<rect x="12.5" y="8" width="26" height="18" fill="#fff" stroke="#D1D5DB"/>
<g fill="#1F2937"><rect x="12.5" y="8" width="6.5" height="6"/><rect x="25.5" y="8" width="6.5" height="6"/>
<rect x="19" y="14" width="6.5" height="6"/><rect x="32" y="14" width="6.5" height="6"/>
<rect x="12.5" y="20" width="6.5" height="6"/><rect x="25.5" y="20" width="6.5" height="6"/></g>`,
  },
  casa: {
    rotulo: "Corretagem / imóvel",
    svg: `<path d="M11 22v18h26V22L24 11z" fill="#F7D9A8"/>
<path d="M6 23L24 8l18 15" fill="none" stroke="#C0392B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="20" y="28" width="8" height="12" rx="1.5" fill="#B9763A"/>`,
  },
  poco: {
    rotulo: "Perfuração de poço",
    svg: `<rect x="11" y="12" width="3" height="18" fill="#8B5A2B"/>
<rect x="34" y="12" width="3" height="18" fill="#8B5A2B"/>
<path d="M8 13l16-8 16 8z" fill="#C0392B"/>
<path d="M9 28v8c0 3.3 6.7 6 15 6s15-2.7 15-6v-8z" fill="#A8AFB7"/>
<ellipse cx="24" cy="28" rx="15" ry="6" fill="#C9CED6"/>
<ellipse cx="24" cy="28.5" rx="11" ry="3.8" fill="#3B7DD8"/>`,
  },
  documento: {
    rotulo: "Legalização / documento",
    svg: `<path d="M12 6h18l8 8v28H12z" fill="#fff" stroke="#CBD5E1" stroke-width="2" stroke-linejoin="round"/>
<path d="M30 6v8h8" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="2" stroke-linejoin="round"/>
<path d="M17 21h14M17 27h14M17 33h6" stroke="#94A3B8" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="33" cy="36" r="7" fill="#22A06B"/>
<path d="M29.5 36l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
};
