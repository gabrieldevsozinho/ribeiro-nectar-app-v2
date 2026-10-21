import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DadosMapa } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../api";
import { LocalizarPendentes } from "../../componentes/mapa/localizar-pendentes";
import { Botao, Carregando, ErroCarregar, TituloPagina, useTitulo } from "../../componentes/ui";
import { useConfigMapa, useUsuario } from "./contexto";
import { PainelMapa } from "./painel-mapa";
import { DialogoPrazos } from "./prazos-visita";

export default function PaginaMapa() {
  useTitulo("Mapa e cidades");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const ehMaster = usuario.papel === "master";
  // A API decide o que entra: o revendedor só vê onde ele vendeu.
  const dados = useQuery({ queryKey: chave(slug, "mapa"), queryFn: () => api.get<DadosMapa>(daEmpresa(slug, "/mapa")) });
  const mapa = useConfigMapa(slug);
  const [editandoPrazos, setEditandoPrazos] = useState(false);

  return (
    <>
      <TituloPagina
        titulo="Mapa e cidades"
        descricao={
          ehMaster
            ? "Escolha a cidade para ver os comércios e há quanto tempo cada um comprou."
            : "Onde você vendeu. Escolha a cidade para ver os comércios e há quanto tempo cada um comprou."
        }
      />
      {dados.isError ? (
        <ErroCarregar erro={dados.error} aoTentar={() => dados.refetch()} />
      ) : !dados.data || !mapa.data ? (
        <Carregando />
      ) : (
        <>
          {ehMaster && !dados.data.prazos && (
            <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-cartao)] border border-mel/40 bg-mel-claro p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Defina os prazos de visita</p>
                <p className="text-sm text-texto-2">
                  Com eles, cada comércio ganha uma cor no mapa (em dia, atenção ou atrasado) pelos dias desde a última venda.
                </p>
              </div>
              <Botao type="button" onClick={() => setEditandoPrazos(true)} className="w-full sm:w-auto">
                Definir prazos
              </Botao>
            </div>
          )}
          {ehMaster && mapa.data.disponivel && (dados.data.pendentes.aLocalizar > 0 || dados.data.pendentes.naoEncontrados.length > 0) && (
            <div className="mb-3">
              <LocalizarPendentes
                config={mapa.data}
                modo="mapa"
                aLocalizar={dados.data.pendentes.aLocalizar}
                naoEncontrados={dados.data.pendentes.naoEncontrados}
              />
            </div>
          )}
          <PainelMapa
            mapa={mapa.data}
            pontos={dados.data.pontos}
            prazos={dados.data.prazos}
            ehMaster={ehMaster}
            aoAlterarPrazos={() => setEditandoPrazos(true)}
          />
          {editandoPrazos && <DialogoPrazos slug={slug} prazos={dados.data.prazos} aoFechar={() => setEditandoPrazos(false)} />}
        </>
      )}
    </>
  );
}
