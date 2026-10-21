import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarDataHora, formatarMoeda } from "@/compartilhado/formato";
import { EXCLUSAO_DE_REVENDEDOR_LIGADA } from "@/compartilhado/recursos";
import type { ResultadoAcao, RevendedorDetalhe } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, ErroApi, fila } from "../../../api";
import { Aviso, Botao, Campo, Carregando, Cartao, ErroCarregar, LinkVoltar, Selo, TituloPagina, Vazio, useTitulo } from "../../../componentes/ui";
import { useUsuario } from "../contexto";

export default function PaginaRevendedor() {
  useTitulo("Revendedor");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const id = useParams().id ?? "";
  const detalhe = useQuery({
    queryKey: chave(slug, "revendedores", id),
    queryFn: () => api.get<RevendedorDetalhe>(daEmpresa(slug, `/revendedores/${id}`)),
    enabled: usuario.papel === "master",
  });

  if (usuario.papel !== "master") return <Navigate to={`/${slug}/vendas`} replace />;
  if (detalhe.isError) return <ErroCarregar erro={detalhe.error} aoTentar={() => detalhe.refetch()} />;
  if (!detalhe.data) return <Carregando />;

  const { revendedor, vendas } = detalhe.data;

  return (
    <>
      <LinkVoltar para={`/${slug}/revendedores`}>Revendedores</LinkVoltar>
      <TituloPagina
        titulo={revendedor.nome}
        descricao={
          <span className="flex flex-wrap gap-2">
            {revendedor.bloqueado ? <Selo tipo="erro">Bloqueado</Selo> : <Selo tipo="sucesso">Ativo</Selo>}
            {revendedor.deveTrocarSenha && <Selo tipo="alerta">Primeiro acesso pendente</Selo>}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Contato</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="text-texto-3">E-mail</dt>
                <dd className="break-all font-medium">{revendedor.email}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Telefone</dt>
                <dd className="font-medium">
                  {revendedor.telefone ? (
                    <a className="text-mel-texto underline-offset-2 hover:underline" href={`tel:${revendedor.telefone.replace(/\D/g, "")}`}>
                      {revendedor.telefone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-texto-3">Endereço</dt>
                <dd className="font-medium">{revendedor.endereco || "—"}</dd>
              </div>
            </dl>
          </Cartao>

          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Acesso</h2>
            <AcoesRevendedor slug={slug} perfilId={revendedor.id} nome={revendedor.nome} bloqueado={revendedor.bloqueado} />
          </Cartao>
        </div>

        <Cartao>
          <h2 className="font-titulo text-lg font-bold">Últimas vendas</h2>
          {vendas.length > 0 ? (
            <ul className="mt-3 divide-y divide-borda">
              {vendas.map((v) => (
                <li key={v.id}>
                  <Link to={`/${slug}/vendas/${v.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-mel-texto">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{v.ponto.nome}</p>
                      <p className="text-sm text-texto-2">
                        {formatarDataHora(v.dataVenda)} · {v.ponto.cidade}/{v.ponto.uf}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">{formatarMoeda(v.valorTotal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <Vazio titulo="Nenhuma venda registrada" />
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}

function AcoesRevendedor({ slug, perfilId, nome, bloqueado }: { slug: string; perfilId: string; nome: string; bloqueado: boolean }) {
  const bloqueio = useMutation({
    mutationFn: (bloquear: boolean) => api.patch<{ sucesso: string }>(daEmpresa(slug, `/revendedores/${perfilId}/bloqueio`), { bloquear }),
    onSuccess: () => fila.invalidateQueries({ queryKey: chave(slug, "revendedores") }),
  });
  const pedido = useMutation({
    mutationFn: () => api.post<ResultadoAcao>(daEmpresa(slug, `/revendedores/${perfilId}/codigo-exclusao`)),
  });
  const ocupado = bloqueio.isPending || pedido.isPending;
  // Código vencido ou tentativas esgotadas: a tela volta ao botão, com o motivo.
  const [erroCodigo, setErroCodigo] = useState<string>();

  return (
    <div className="mt-3 flex flex-col gap-4">
      {bloqueio.isError && <Aviso tipo="erro">{bloqueio.error.message}</Aviso>}
      {bloqueio.isSuccess && <Aviso tipo="sucesso">{bloqueio.data.sucesso}</Aviso>}

      <div>
        <p className="text-sm text-texto-2">
          {bloqueado
            ? "O revendedor não consegue entrar enquanto estiver bloqueado."
            : "Bloqueado, o revendedor é desconectado e não consegue mais entrar. Dá para desbloquear depois."}
        </p>
        <Botao
          type="button"
          variante={bloqueado ? "primario" : "secundario"}
          className="mt-3"
          disabled={ocupado}
          onClick={() => {
            if (!bloqueado && !window.confirm(`Bloquear o acesso de ${nome}?`)) return;
            bloqueio.mutate(!bloqueado);
          }}
        >
          {bloqueio.isPending ? "Salvando…" : bloqueado ? "Desbloquear acesso" : "Bloquear acesso"}
        </Botao>
      </div>

      {EXCLUSAO_DE_REVENDEDOR_LIGADA && (
        <div className="border-t border-borda pt-4">
          <p className="text-sm font-semibold text-erro">Excluir cadastro</p>
          <p className="mt-1 text-sm text-texto-2">
            O login é apagado e os dados pessoais são removidos. As vendas continuam no histórico como “Revendedor removido”. Para
            confirmar, enviamos um código para o seu e-mail.
          </p>
          {pedido.data?.codigoEnviado ? (
            <ConfirmarCodigo
              slug={slug}
              perfilId={perfilId}
              aviso={pedido.data.sucesso}
              aoRecomecar={(mensagem) => {
                pedido.reset();
                setErroCodigo(mensagem);
              }}
            />
          ) : (
            <>
              {(pedido.isError || erroCodigo) && (
                <Aviso tipo="erro" className="mt-3">
                  {pedido.error?.message ?? erroCodigo}
                </Aviso>
              )}
              <Botao
                type="button"
                variante="perigo"
                className="mt-3"
                disabled={ocupado}
                onClick={() => {
                  if (!window.confirm(`Excluir ${nome}? Isso não pode ser desfeito.`)) return;
                  setErroCodigo(undefined);
                  pedido.mutate();
                }}
              >
                {pedido.isPending ? "Enviando código…" : "Excluir revendedor"}
              </Botao>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmarCodigo({
  slug,
  perfilId,
  aviso,
  aoRecomecar,
}: {
  slug: string;
  perfilId: string;
  aviso?: string;
  aoRecomecar: (mensagem: string) => void;
}) {
  const navegar = useNavigate();
  const [erro, setErro] = useState<string>();
  const confirmar = useMutation({
    mutationFn: (codigo: string) => api.post(daEmpresa(slug, `/revendedores/${perfilId}/exclusao`), { codigo }),
    onSuccess: async () => {
      await fila.invalidateQueries({ queryKey: chave(slug) });
      navegar(`/${slug}/revendedores?excluido=1`);
    },
    onError: (e) => {
      // Sem mais tentativas (ou código vencido): volta para o botão de pedir um código novo.
      if (e instanceof ErroApi && e.corpo?.codigoEnviado === false) aoRecomecar(e.message);
      else setErro(e.message);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        confirmar.mutate(String(new FormData(e.currentTarget).get("codigo") ?? ""));
      }}
      className="mt-3 flex flex-col gap-3"
    >
      {aviso && !erro && <Aviso tipo="info">{aviso} Ele vale por 15 minutos.</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo
        rotulo="Código recebido por e-mail"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]{6}"
        required
        className="max-w-48"
      />
      <div>
        <Botao type="submit" variante="perigo" disabled={confirmar.isPending}>
          {confirmar.isPending ? "Excluindo…" : "Confirmar exclusão"}
        </Botao>
      </div>
    </form>
  );
}
