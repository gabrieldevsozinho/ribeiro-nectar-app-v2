import type { Situacao } from "@/compartilhado/semaforo";

/**
 * Cores do semáforo nos pinos e nas bolinhas. O mapa é sempre claro, então valem nos dois temas.
 * Sem prazos definidos, o pino fica cor de mel.
 */
export const COR_PINO: Record<Situacao | "sem_prazo", { fundo: string; borda: string; miolo: string }> = {
  em_dia: { fundo: "#2f9e5b", borda: "#1a5c35", miolo: "#ffffff" },
  atencao: { fundo: "#f2c230", borda: "#8a6a00", miolo: "#3a2c00" },
  atrasado: { fundo: "#d64545", borda: "#7d1f1f", miolo: "#ffffff" },
  sem_prazo: { fundo: "#e29a12", borda: "#7a4a00", miolo: "#2a1a00" },
};

/** Cor do texto da situação (segue o tema claro/escuro). */
export const COR_TEXTO_SITUACAO: Record<Situacao, string> = {
  em_dia: "text-sucesso",
  atencao: "text-alerta",
  atrasado: "text-erro",
};

export function Bolinha({ situacao, tamanho = 10 }: { situacao: Situacao; tamanho?: number }) {
  const cor = COR_PINO[situacao];
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: tamanho, height: tamanho, background: cor.fundo, boxShadow: `inset 0 0 0 1px ${cor.borda}` }}
    />
  );
}
