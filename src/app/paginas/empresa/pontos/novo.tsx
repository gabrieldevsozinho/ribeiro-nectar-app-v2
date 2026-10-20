import { useNavigate, useSearchParams } from "react-router";
import { api, chave, daEmpresa, fila } from "../../../api";
import { Carregando, LinkVoltar, TituloPagina, useTitulo } from "../../../componentes/ui";
import { useConfigMapa, useUsuario } from "../contexto";
import { FormularioPonto } from "./formulario-ponto";

export default function PaginaNovoPonto() {
  useTitulo("Cadastrar ponto de venda");
  const slug = useUsuario().empresa.slug;
  const navegar = useNavigate();
  const voltandoParaVenda = useSearchParams()[0].get("depois") === "venda";
  const mapa = useConfigMapa(slug);

  return (
    <>
      <LinkVoltar para={voltandoParaVenda ? `/${slug}/vendas/nova` : `/${slug}/pontos`}>
        {voltandoParaVenda ? "Nova venda" : "Pontos de venda"}
      </LinkVoltar>
      <TituloPagina titulo="Cadastrar ponto de venda" descricao="Um cadastro por comércio. Se o CNPJ ou o endereço já existirem, o sistema avisa." />
      {!mapa.data ? (
        <Carregando />
      ) : (
        <FormularioPonto
          mapa={mapa.data}
          rotuloEnviar={voltandoParaVenda ? "Salvar e voltar para a venda" : "Cadastrar ponto"}
          salvar={async (corpo) => {
            const { id } = await api.post<{ id: string }>(daEmpresa(slug, "/pontos"), corpo);
            await fila.invalidateQueries({ queryKey: chave(slug, "pontos") });
            // Vindo da nova venda, volta para ela com o ponto já escolhido.
            navegar(voltandoParaVenda ? `/${slug}/vendas/nova?ponto=${id}` : `/${slug}/pontos/${id}`);
          }}
        />
      )}
    </>
  );
}
