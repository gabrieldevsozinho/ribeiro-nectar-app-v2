import { useQuery } from "@tanstack/react-query";
import type { DadosMapa } from "@/compartilhado/tipos";
import { api, chave, daEmpresa } from "../../api";
import { LocalizarPendentes } from "../../componentes/mapa/localizar-pendentes";
import { Carregando, ErroCarregar, TituloPagina, useTitulo } from "../../componentes/ui";
import { useConfigMapa, useUsuario } from "./contexto";
import { PainelMapa } from "./painel-mapa";

export default function PaginaMapa() {
  useTitulo("Mapa e cidades");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const ehMaster = usuario.papel === "master";
  // A API decide o que entra: o revendedor só vê onde ele vendeu.
  const dados = useQuery({ queryKey: chave(slug, "mapa"), queryFn: () => api.get<DadosMapa>(daEmpresa(slug, "/mapa")) });
  const mapa = useConfigMapa(slug);

  return (
    <>
      <TituloPagina
        titulo="Mapa e cidades"
        descricao={
          ehMaster
            ? "Onde a empresa vende. Toque num marcador ou escolha uma cidade para ver as vendas."
            : "Onde você vendeu. Toque num marcador ou escolha uma cidade para ver as suas vendas."
        }
      />
      {dados.isError ? (
        <ErroCarregar erro={dados.error} aoTentar={() => dados.refetch()} />
      ) : !dados.data || !mapa.data ? (
        <Carregando />
      ) : (
        <>
          {ehMaster && dados.data.pendentes > 0 && mapa.data.disponivel && (
            <div className="mb-4">
              <LocalizarPendentes config={mapa.data} automatico />
            </div>
          )}
          <PainelMapa
            mapa={mapa.data}
            cidades={dados.data.cidades.map((c) => ({ ...c, chave: `${c.cidade}|${c.uf}` }))}
            pontos={dados.data.pontos}
          />
        </>
      )}
    </>
  );
}
