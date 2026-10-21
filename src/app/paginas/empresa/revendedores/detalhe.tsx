import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarDataHora, formatarMoeda, paraComparar } from "@/compartilhado/formato";
import type { RevendedorDetalhe } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila } from "../../../api";
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
  const navegar = useNavigate();
  const bloqueio = useMutation({
    mutationFn: (bloquear: boolean) => api.patch<{ sucesso: string }>(daEmpresa(slug, `/revendedores/${perfilId}/bloqueio`), { bloquear }),
    onSuccess: () => fila.invalidateQueries({ queryKey: chave(slug, "revendedores") }),
  });
  const exclusao = useMutation({
    mutationFn: (confirmacao: string) => api.post(daEmpresa(slug, `/revendedores/${perfilId}/exclusao`), { confirmacao }),
    onSuccess: async () => {
      await fila.invalidateQueries({ queryKey: chave(slug) });
      navegar(`/${slug}/revendedores?excluido=1`);
    },
  });
  const ocupado = bloqueio.isPending || exclusao.isPending;
  // Para não excluir por engano, o master digita o nome do revendedor.
  const [confirmando, setConfirmando] = useState(false);
  const [digitado, setDigitado] = useState("");
  const nomeConfere = paraComparar(digitado) === paraComparar(nome);

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

      <div className="border-t border-borda pt-4">
        <p className="text-sm font-semibold text-erro">Excluir cadastro</p>
        <p className="mt-1 text-sm text-texto-2">
          O login é apagado e os dados pessoais são removidos. As vendas continuam no histórico como “Revendedor removido”. Isso não
          pode ser desfeito.
        </p>
        {confirmando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nomeConfere) exclusao.mutate(digitado);
            }}
            className="mt-3 flex flex-col gap-3"
          >
            {exclusao.isError && <Aviso tipo="erro">{exclusao.error.message}</Aviso>}
            <Campo
              rotulo={`Para confirmar, digite o nome: ${nome}`}
              name="confirmacao"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
            <div className="flex flex-wrap gap-2">
              <Botao type="submit" variante="perigo" disabled={!nomeConfere || ocupado}>
                {exclusao.isPending ? "Excluindo…" : "Excluir definitivamente"}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                disabled={exclusao.isPending}
                onClick={() => {
                  setConfirmando(false);
                  setDigitado("");
                  exclusao.reset();
                }}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <Botao type="button" variante="perigo" className="mt-3" disabled={ocupado} onClick={() => setConfirmando(true)}>
            Excluir revendedor
          </Botao>
        )}
      </div>
    </div>
  );
}
