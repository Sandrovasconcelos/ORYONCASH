export type TipoPeriodoComparativo = "mes_atual" | "semana_atual" | "ano_atual";

export type Intervalo = { inicio: string; fim: string };

export type Comparativo = {
  atual: Intervalo;
  anterior: Intervalo;
  rotuloAtual: string;
  rotuloAnterior: string;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Compara o periodo ATUAL ate hoje com o MESMO trecho do periodo anterior
 * (mes ate o dia X x mes passado ate o dia X) - comparar "mes inteiro" com
 * "mes ainda pela metade" sempre diria que gastou menos.
 */
export function periodosComparativos(hoje: string, tipo: TipoPeriodoComparativo): Comparativo {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (tipo === "semana_atual") {
    const atual = new Date(Date.UTC(ano, mes - 1, dia));
    const diasDesdeSegunda = (atual.getUTCDay() + 6) % 7;
    const segunda = new Date(atual);
    segunda.setUTCDate(atual.getUTCDate() - diasDesdeSegunda);
    const segundaAnterior = new Date(segunda);
    segundaAnterior.setUTCDate(segunda.getUTCDate() - 7);
    const mesmoDiaAnterior = new Date(atual);
    mesmoDiaAnterior.setUTCDate(atual.getUTCDate() - 7);
    return {
      atual: { inicio: iso(segunda), fim: hoje },
      anterior: { inicio: iso(segundaAnterior), fim: iso(mesmoDiaAnterior) },
      rotuloAtual: "Esta semana",
      rotuloAnterior: "Semana passada",
    };
  }

  if (tipo === "ano_atual") {
    const diaAnterior = mes === 2 && dia === 29 ? 28 : dia;
    return {
      atual: { inicio: `${ano}-01-01`, fim: hoje },
      anterior: { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-${pad(mes)}-${pad(diaAnterior)}` },
      rotuloAtual: `${ano}`,
      rotuloAnterior: `${ano - 1}`,
    };
  }

  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoDoMesAnterior = mes === 1 ? ano - 1 : ano;
  const diaAnterior = Math.min(dia, ultimoDiaDoMes(anoDoMesAnterior, mesAnterior));
  return {
    atual: { inicio: `${ano}-${pad(mes)}-01`, fim: hoje },
    anterior: {
      inicio: `${anoDoMesAnterior}-${pad(mesAnterior)}-01`,
      fim: `${anoDoMesAnterior}-${pad(mesAnterior)}-${pad(diaAnterior)}`,
    },
    rotuloAtual: "Este mês",
    rotuloAnterior: "Mês passado",
  };
}
