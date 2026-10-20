import { Navigate, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { PontoDetalhe } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila } from "../../../api";
import { Carregando, ErroCarregar, LinkVoltar, TituloPagina, useTitulo } from "../../../componentes/ui";
import { useConfigMapa, useUsuario } from "../contexto";
import { FormularioPonto } from "./formulario-ponto";

export default function PaginaEditarPonto() {
  useTitulo("Editar ponto de venda");
  const slug = useUsuario().empresa.slug;
  const id = useParams().id ?? "";
  const navegar = useNavigate();
  const ponto = useQuery({ queryKey: chave(slug, "pontos", id), queryFn: () => api.get<PontoDetalhe>(daEmpresa(slug, `/pontos/${id}`)) });
  const mapa = useConfigMapa(slug);

  if (ponto.isError) return <ErroCarregar erro={ponto.error} aoTentar={() => ponto.refetch()} />;
  if (!ponto.data || !mapa.data) return <Carregando />;
  // Só o master ou quem cadastrou o ponto altera (a API confere de novo).
  if (!ponto.data.podeEditar) return <Navigate to={`/${slug}/pontos/${id}`} replace />;

  return (
    <>
      <LinkVoltar para={`/${slug}/pontos/${id}`}>{ponto.data.nome}</LinkVoltar>
      <TituloPagina titulo="Editar ponto de venda" />
      <FormularioPonto
        mapa={mapa.data}
        ponto={ponto.data}
        rotuloEnviar="Salvar alterações"
        salvar={async (corpo) => {
          await api.put(daEmpresa(slug, `/pontos/${id}`), corpo);
          await fila.invalidateQueries({ queryKey: chave(slug) });
          navegar(`/${slug}/pontos/${id}`);
        }}
      />
    </>
  );
}
