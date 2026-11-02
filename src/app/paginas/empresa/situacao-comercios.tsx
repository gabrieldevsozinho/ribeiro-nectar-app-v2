import { useMemo, useState } from "react";
import { formatarData } from "@/compartilhado/formato";
import { descreverPrazo, haQuantoTempo, ROTULO_SITUACAO, SITUACOES, situacaoPelosDias, type Situacao } from "@/compartilhado/semaforo";
import type { PrazosVisita } from "@/compartilhado/tipos";
import { Bolinha, COR_TEXTO_SITUACAO } from "../../componentes/mapa/situacao";
import { Botao } from "../../componentes/ui";

type Comercio = { id: string; nome: string; cidade: string; uf: string; ultimaVenda: string; dias: number };

type Filtro = "todos" | Situacao;

const ROTULO_FILTRO: Record<Situacao, string> = { em_dia: "Em dia", atencao: "Atenção", atrasado: "Atrasados" };

const NENHUM_NO_FILTRO: Record<Situacao, string> = {
  atrasado: "Nenhum comércio atrasado.",
  atencao: "Nenhum comércio em atenção.",
  em_dia: "Nenhum comércio em dia.",
};

/**
 * Todos os comércios numa tabela, pelo semáforo de visitas: os atrasados primeiro e,
 * para cada um, quanto falta para mudar de cor (nos em dia, para entrar em atenção).
 */
export function SituacaoComercios<T extends Comercio>({
  comercios,
  prazos,
  ehMaster,
  aoAbrir,
  aoDefinirPrazos,
}: {
  comercios: T[];
  prazos: PrazosVisita | null;
  ehMaster: boolean;
  aoAbrir: (comercio: T) => void;
  aoDefinirPrazos: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Mais dias sem compra primeiro: atrasados, depois atenção, depois os em dia mais perto de entrar em atenção.
  const linhas = useMemo(
    () =>
      prazos
        ? [...comercios]
            .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, "pt-BR"))
            .map((comercio) => ({ comercio, situacao: situacaoPelosDias(comercio.dias, prazos) }))
        : [],
    [comercios, prazos],
  );
  const porSituacao = useMemo(() => {
    const contagem: Record<Situacao, number> = { em_dia: 0, atencao: 0, atrasado: 0 };
    for (const l of linhas) contagem[l.situacao]++;
    return contagem;
  }, [linhas]);
  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.situacao === filtro);

  return (
    <section
      aria-labelledby="situacao-comercios-titulo"
      className="mt-4 overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-superficie"
    >
      <div className="border-b border-borda px-4 py-3">
        <h2 id="situacao-comercios-titulo" className="font-titulo text-xl font-bold">
          Situação dos comércios
        </h2>
        {prazos ? (
          <>
            <p className="text-sm text-texto-2">Os atrasados primeiro. Nos em dia, quanto falta para entrar em atenção.</p>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Filtrar a tabela por situação">
              {(["todos", ...SITUACOES] as Filtro[]).map((f) => {
                const ativo = filtro === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      ativo ? "border-texto bg-texto text-fundo" : "border-borda-forte bg-superficie text-texto-2 hover:bg-superficie-2"
                    }`}
                  >
                    {f !== "todos" && <Bolinha situacao={f} />}
                    {f === "todos" ? "Todos" : ROTULO_FILTRO[f]}
                    <span className={ativo ? "opacity-75" : "text-texto-3"}>{f === "todos" ? linhas.length : porSituacao[f]}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-texto-2">
              {ehMaster
                ? "Defina os prazos de visita para ver quais comércios estão atrasados, quais pedem atenção e quanto falta para os outros."
                : "A tabela aparece quando o master definir os prazos de visita."}
            </p>
            {ehMaster && (
              <Botao type="button" variante="secundario" onClick={aoDefinirPrazos} className="w-full sm:w-auto">
                Definir prazos
              </Botao>
            )}
          </div>
        )}
      </div>

      {prazos &&
        (visiveis.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-2">{filtro !== "todos" && NENHUM_NO_FILTRO[filtro]}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs font-semibold uppercase tracking-wide text-texto-3">
                  <th className="px-4 py-2.5">Comércio</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Última venda</th>
                  <th className="px-3 py-2.5">Situação</th>
                  <th className="px-4 py-2.5">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {visiveis.map(({ comercio: c, situacao }) => (
                  <tr key={c.id} onClick={() => aoAbrir(c)} className="cursor-pointer hover:bg-superficie-2">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          aoAbrir(c);
                        }}
                        className="text-left font-semibold hover:text-mel-texto"
                      >
                        {c.nome}
                      </button>
                      <span className="block text-texto-2">
                        {c.cidade}/{c.uf}
                      </span>
                      <span className="block text-texto-3 sm:hidden">última venda {haQuantoTempo(c.dias)}</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                      {formatarData(c.ultimaVenda)}
                      <span className="block text-texto-2">{haQuantoTempo(c.dias)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-semibold ${COR_TEXTO_SITUACAO[situacao]}`}>
                        <Bolinha situacao={situacao} />
                        {ROTULO_SITUACAO[situacao]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${situacao === "em_dia" ? "text-texto" : COR_TEXTO_SITUACAO[situacao]}`}>
                      {descreverPrazo(c.dias, prazos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
