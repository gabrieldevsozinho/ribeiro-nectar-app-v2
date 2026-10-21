import { useEffect, useRef, useState, type FormEvent } from "react";
import { faixasDosPrazos, PRAZO_MAXIMO_DIAS, SITUACOES, ROTULO_SITUACAO } from "@/compartilhado/semaforo";
import type { PrazosVisita } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila, mensagemDe } from "../../api";
import { Bolinha } from "../../componentes/mapa/situacao";
import { Aviso, Botao, Campo } from "../../componentes/ui";

/** Janela em que o master define os prazos de visita (as cores do mapa). */
export function DialogoPrazos({ slug, prazos, aoFechar }: { slug: string; prazos: PrazosVisita | null; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [emDia, setEmDia] = useState(prazos ? String(prazos.emDia) : "");
  const [atencao, setAtencao] = useState(prazos ? String(prazos.atencao) : "");
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const dias = { emDia: Number(emDia), atencao: Number(atencao) };
  const completos =
    Number.isInteger(dias.emDia) && dias.emDia >= 1 && Number.isInteger(dias.atencao) && dias.atencao > dias.emDia && dias.atencao <= PRAZO_MAXIMO_DIAS;

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(undefined);
    try {
      await api.put(daEmpresa(slug, "/mapa/prazos"), { emDia: emDia.trim(), atencao: atencao.trim() });
      await fila.invalidateQueries({ queryKey: chave(slug, "mapa") });
      dialogo.current?.close();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
      className="m-auto max-h-[90dvh] w-[min(480px,calc(100vw-24px))] overflow-y-auto rounded-[var(--radius-cartao)] border border-borda bg-fundo p-0 text-texto shadow-2xl backdrop:bg-black/45"
      aria-labelledby="prazos-titulo"
    >
      <form onSubmit={salvar} className="flex flex-col gap-4 p-5">
        <div>
          <h2 id="prazos-titulo" className="font-titulo text-xl font-bold">
            Prazos de visita
          </h2>
          <p className="mt-1 text-sm text-texto-2">
            Cada comércio ganha uma cor no mapa, pelos dias desde a última venda. Você decide os dias. Exemplo:
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-2">
            {SITUACOES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <Bolinha situacao={s} /> {faixasDosPrazos({ emDia: 30, atencao: 60 })[s]}
              </span>
            ))}
          </p>
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Em dia até"
            name="emDia"
            type="number"
            inputMode="numeric"
            min={1}
            max={PRAZO_MAXIMO_DIAS - 1}
            value={emDia}
            onChange={(e) => setEmDia(e.target.value)}
            dica="dias"
            required
          />
          <Campo
            rotulo="Atenção até"
            name="atencao"
            type="number"
            inputMode="numeric"
            min={2}
            max={PRAZO_MAXIMO_DIAS}
            value={atencao}
            onChange={(e) => setAtencao(e.target.value)}
            dica="dias"
            required
          />
        </div>

        <div className="rounded-xl bg-superficie-2 px-3.5 py-3 text-sm" aria-live="polite">
          {completos ? (
            <>
              <p className="font-semibold">Com estes prazos:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {SITUACOES.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <Bolinha situacao={s} />
                    <span>
                      <strong>{ROTULO_SITUACAO[s]}</strong>: {faixasDosPrazos(dias)[s]} desde a última venda
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-texto-2">O prazo de atenção precisa ser maior que o prazo em dia. Depois dele, o comércio fica atrasado.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao type="button" variante="secundario" onClick={() => dialogo.current?.close()}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar prazos"}
          </Botao>
        </div>
      </form>
    </dialog>
  );
}
