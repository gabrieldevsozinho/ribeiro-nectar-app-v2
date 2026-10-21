/**
 * Semáforo de visitas: a cor de cada comércio pelos dias desde a última venda,
 * conforme os prazos que o master definiu. Ex.: em dia até 30 dias, atenção até 60, depois atrasado.
 */
import { FUSO } from "./formato";
import type { PrazosVisita } from "./tipos";

export type Situacao = "em_dia" | "atencao" | "atrasado";

export const SITUACOES: Situacao[] = ["em_dia", "atencao", "atrasado"];

export const ROTULO_SITUACAO: Record<Situacao, string> = { em_dia: "Em dia", atencao: "Atenção", atrasado: "Atrasado" };

/** Maior prazo aceito (10 anos). */
export const PRAZO_MAXIMO_DIAS = 3650;

const diaEmBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const numeroDoDia = (data: Date) => Date.parse(`${diaEmBrasilia.format(data)}T00:00:00Z`) / 86_400_000;

/** Dias de calendário (no fuso de Brasília) entre a data e hoje: uma venda de ontem à noite já conta 1 dia. */
export function diasDesde(dataIso: string, agora: Date = new Date()): number {
  return Math.max(0, Math.round(numeroDoDia(agora) - numeroDoDia(new Date(dataIso))));
}

export function situacaoPelosDias(dias: number, prazos: PrazosVisita): Situacao {
  if (dias <= prazos.emDia) return "em_dia";
  if (dias <= prazos.atencao) return "atencao";
  return "atrasado";
}

/** A pior situação de um grupo de comércios (o grupo de pinos no mapa fica com essa cor). */
export function piorSituacao(situacoes: (Situacao | null)[]): Situacao | null {
  for (const s of ["atrasado", "atencao", "em_dia"] as const) if (situacoes.includes(s)) return s;
  return null;
}

/** "hoje", "ontem", "há 45 dias" */
export function haQuantoTempo(dias: number): string {
  if (dias === 0) return "hoje";
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** Faixa de cada cor em texto: "até 30 dias", "de 31 a 60 dias", "mais de 60 dias". */
export function faixasDosPrazos({ emDia, atencao }: PrazosVisita): Record<Situacao, string> {
  return {
    em_dia: `até ${emDia} ${emDia === 1 ? "dia" : "dias"}`,
    atencao: emDia + 1 === atencao ? `${atencao} dias` : `de ${emDia + 1} a ${atencao} dias`,
    atrasado: `mais de ${atencao} dias`,
  };
}
