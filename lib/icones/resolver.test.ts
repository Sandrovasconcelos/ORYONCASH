import { describe, expect, it } from "vitest";
import { chaveIconePorNome, chaveIconeDe } from "./resolver";

describe("chaveIconePorNome", () => {
  it.each([
    ["TRENA FITA ACO 5M L500 LUFKIN", "trena"],
    ["TRENA EMBORRACHADA 5M 500054 GOLFIELD", "trena"],
    ["SERRA MANUAL BI-METAL KBS-1218D STARRETT", "serra"],
    ["DISCO SERRA MAD 24DX20X110MM", "disco"],
    ["BROCA ACO RAP 5/16 8MM IRWIN", "broca"],
    ["BOTINA SEG ELAST S/BICO 43 PTA SUL", "bota"],
    ["LINHA PEDREIRO 0,80X100MT COLLINS", "linha"],
    ["LUVA LATEX NEOPRENE 8M AZL/AMA", "luva"],
    ["ESGOTO LUVA 100MM TIGRE", "hidraulico"],
    ["EXTRALATEX FOSCO 3,6L BRANCO GELO HIDRACOR", "pintura"],
    ["Pagamento Pix para Elza Pereira do Nascimento", "pix"],
    ["CIMENTO TDS OBRAS 50KG POTY", "cimento"],
    ["VERGALHAO CA50 10,0MM RETO NERV 12M N", "ferro"],
    ["DOBRADICA 3.1/2X3\" ACO FOX C/ANEL1525 FAMA", "esquadria"],
    ["MARTELO 27MM UNHA 40370/027 TRAMONTINA", "martelo"],
    ["ESPACADOR NIVEL PISO 1MM AZUL 61334 CORTAG", "piso"],
    ["Conta de luz 150526", "luz"],
    ["CAIXA LUZ 4X2 QUAD AMA", "eletrico"],
    ["Refeição obra", "refeicao"],
    ["Algo totalmente desconhecido xyz", "generico"],
  ])("%s -> %s", (nome, esperado) => {
    expect(chaveIconePorNome(nome)).toBe(esperado);
  });
});

describe("chaveIconeDe", () => {
  it("usa o primeiro texto com icone especifico", () => {
    expect(chaveIconeDe("-", "TRENA FITA ACO 5M", "Mão de Obra Alex")).toBe("trena");
    expect(chaveIconeDe("-", "algo sem regra xyz", "Mão de Obra Alex")).toBe("maoDeObra");
    expect(chaveIconeDe(null, undefined)).toBe("generico");
  });
});
