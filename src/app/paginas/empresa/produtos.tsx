import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import type { Produto } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila, lerFormulario } from "../../api";
import { Aviso, Botao, Campo, Carregando, Cartao, ErroCarregar, Selo, TituloPagina, Vazio, useTitulo } from "../../componentes/ui";
import { useUsuario } from "./contexto";

function precoParaCampo(valor: number) {
  return Number(valor).toFixed(2).replace(".", ",");
}

const recarregar = (slug: string) => fila.invalidateQueries({ queryKey: chave(slug) });

export default function PaginaProdutos() {
  useTitulo("Produtos");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const ehMaster = usuario.papel === "master";
  const produtos = useQuery({ queryKey: chave(slug, "produtos"), queryFn: () => api.get<Produto[]>(daEmpresa(slug, "/produtos")) });

  const ativos = (produtos.data ?? []).filter((p) => p.ativo);
  const inativos = (produtos.data ?? []).filter((p) => !p.ativo);

  return (
    <>
      <TituloPagina titulo="Produtos" descricao="Catálogo da empresa. Na venda, o revendedor escolhe daqui e o preço sugerido já vem preenchido." />
      <div className="flex max-w-3xl flex-col gap-5">
        {ehMaster && (
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Novo produto</h2>
            <FormularioNovoProduto slug={slug} />
          </Cartao>
        )}

        {produtos.isError ? (
          <ErroCarregar erro={produtos.error} aoTentar={() => produtos.refetch()} />
        ) : !produtos.data ? (
          <Carregando />
        ) : ativos.length === 0 ? (
          <Vazio titulo="Nenhum produto no catálogo">
            {ehMaster ? "Cadastre o primeiro produto acima." : "Peça ao master da empresa para cadastrar os produtos."}
          </Vazio>
        ) : (
          <Cartao className="p-0">
            <ul className="divide-y divide-borda">
              {ativos.map((p) =>
                ehMaster ? (
                  <LinhaProdutoEditavel key={p.id} slug={slug} produto={p} />
                ) : (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold">{p.nome}</p>
                      <p className="text-sm text-texto-2">{p.unidade}</p>
                    </div>
                    <span className="shrink-0 font-semibold">{formatarMoeda(p.precoSugerido)}</span>
                  </li>
                ),
              )}
            </ul>
          </Cartao>
        )}

        {ehMaster && inativos.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-texto-2">
              Desativados <Selo>{inativos.length}</Selo>
            </h2>
            <p className="mb-3 text-sm text-texto-3">Não aparecem nas vendas novas, mas continuam nas vendas antigas.</p>
            <Cartao className="p-0">
              <ul className="divide-y divide-borda">
                {inativos.map((p) => (
                  <LinhaProdutoEditavel key={p.id} slug={slug} produto={p} />
                ))}
              </ul>
            </Cartao>
          </section>
        )}
      </div>
    </>
  );
}

function FormularioNovoProduto({ slug }: { slug: string }) {
  // A versão muda a cada produto salvo: o formulário volta vazio.
  const [versao, setVersao] = useState(0);
  const criar = useMutation({
    mutationFn: (dados: Record<string, string>) => api.post<{ sucesso: string }>(daEmpresa(slug, "/produtos"), dados),
    onSuccess: () => {
      setVersao((v) => v + 1);
      return recarregar(slug);
    },
  });

  return (
    <form
      key={versao}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        criar.mutate(lerFormulario(e.currentTarget));
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}
      {criar.isSuccess && <Aviso tipo="sucesso">{criar.data.sucesso}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Campo rotulo="Nome" name="nome" placeholder="Mel silvestre" required />
        <Campo rotulo="Unidade" name="unidade" placeholder="pote 1 kg" required />
        <Campo rotulo="Preço sugerido (R$)" name="preco" inputMode="decimal" placeholder="45,00" required />
      </div>
      <div>
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? "Adicionando…" : "Adicionar produto"}
        </Botao>
      </div>
    </form>
  );
}

function LinhaProdutoEditavel({ slug, produto }: { slug: string; produto: Produto }) {
  const [editando, setEditando] = useState(false);
  const alterar = useMutation({
    mutationFn: (dados: Record<string, string>) => api.put(daEmpresa(slug, `/produtos/${produto.id}`), dados),
    onSuccess: async () => {
      await recarregar(slug);
      setEditando(false);
    },
  });
  const alternar = useMutation({
    mutationFn: () => api.patch(daEmpresa(slug, `/produtos/${produto.id}/ativo`), { ativo: !produto.ativo }),
    onSuccess: () => recarregar(slug),
  });

  if (editando) {
    return (
      <li className="px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alterar.mutate(lerFormulario(e.currentTarget));
          }}
          className="flex flex-col gap-3"
        >
          {alterar.isError && <Aviso tipo="erro">{alterar.error.message}</Aviso>}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <Campo rotulo="Nome" name="nome" defaultValue={produto.nome} required />
            <Campo rotulo="Unidade" name="unidade" defaultValue={produto.unidade} required />
            <Campo rotulo="Preço sugerido (R$)" name="preco" inputMode="decimal" defaultValue={precoParaCampo(produto.precoSugerido)} required />
          </div>
          <div className="flex gap-2">
            <Botao type="submit" disabled={alterar.isPending}>
              {alterar.isPending ? "Salvando…" : "Salvar"}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => {
                alterar.reset();
                setEditando(false);
              }}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${produto.ativo ? "" : "text-texto-3"}`}>{produto.nome}</p>
        <p className="text-sm text-texto-2">{produto.unidade}</p>
        {alternar.isError && <p className="text-sm text-erro">{alternar.error.message}</p>}
      </div>
      <span className="font-semibold">{formatarMoeda(produto.precoSugerido)}</span>
      <div className="flex gap-1">
        <Botao type="button" variante="fantasma" className="min-h-9 px-3 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <Botao type="button" variante="fantasma" className="min-h-9 px-3 text-sm" disabled={alternar.isPending} onClick={() => alternar.mutate()}>
          {produto.ativo ? "Desativar" : "Reativar"}
        </Botao>
      </div>
    </li>
  );
}
