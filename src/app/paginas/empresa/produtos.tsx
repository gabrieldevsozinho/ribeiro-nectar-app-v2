import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import { UNIDADES_SUGERIDAS } from "@/compartilhado/produtos";
import type { CategoriaProduto, Produto } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, ErroApi, fila, lerFormulario } from "../../api";
import { IconeFechar, IconeMais } from "../../componentes/icones";
import { Aviso, Botao, Campo, Carregando, Cartao, ErroCarregar, Selecao, Selo, TituloPagina, Vazio, useTitulo } from "../../componentes/ui";
import { useUsuario } from "./contexto";

function precoParaCampo(valor: number) {
  return Number(valor).toFixed(2).replace(".", ",");
}

const recarregar = (slug: string) => fila.invalidateQueries({ queryKey: chave(slug) });

/** Junta os produtos pela categoria (object vindo da API), na ordem em que ela já manda (alfabética). */
function porCategoria(lista: Produto[]) {
  const grupos: { chave: string; rotulo: string; produtos: Produto[] }[] = [];
  for (const p of lista) {
    const chave = p.categoria?.id ?? "sem-categoria";
    const grupo = grupos.find((g) => g.chave === chave);
    if (grupo) grupo.produtos.push(p);
    else grupos.push({ chave, rotulo: p.categoria?.nome ?? "Sem categoria", produtos: [p] });
  }
  return grupos;
}

export default function PaginaProdutos() {
  useTitulo("Produtos");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const ehMaster = usuario.papel === "master";
  const produtos = useQuery({ queryKey: chave(slug, "produtos"), queryFn: () => api.get<Produto[]>(daEmpresa(slug, "/produtos")) });
  const categorias = useQuery({
    queryKey: chave(slug, "produtos", "categorias"),
    queryFn: () => api.get<CategoriaProduto[]>(daEmpresa(slug, "/produtos/categorias")),
    enabled: ehMaster,
  });

  const ativos = porCategoria((produtos.data ?? []).filter((p) => p.ativo));
  const inativos = (produtos.data ?? []).filter((p) => !p.ativo);

  return (
    <>
      <TituloPagina
        titulo="Produtos"
        descricao="Catálogo da empresa, organizado por linha (mel, própolis, pólen…). Na venda, o revendedor escolhe daqui e o preço sugerido já vem preenchido."
      />
      <div className="flex max-w-3xl flex-col gap-5">
        {ehMaster && (
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Categorias</h2>
            <p className="mt-1 text-sm text-texto-2">As linhas do catálogo (mel, própolis, pólen…). Crie as suas ou exclua as que não usa.</p>
            {categorias.isError ? (
              <ErroCarregar erro={categorias.error} aoTentar={() => categorias.refetch()} />
            ) : !categorias.data ? (
              <Carregando />
            ) : (
              <CategoriasProduto slug={slug} categorias={categorias.data} />
            )}
          </Cartao>
        )}

        {ehMaster && (
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Novo produto</h2>
            {categorias.data && categorias.data.length === 0 ? (
              <p className="mt-3 text-sm text-texto-2">Crie uma categoria acima antes de cadastrar o primeiro produto.</p>
            ) : (
              <FormularioNovoProduto slug={slug} categorias={categorias.data ?? []} />
            )}
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
          <div className="flex flex-col gap-4">
            {ativos.map(({ chave: chaveGrupo, rotulo, produtos: daCategoria }) => (
              <section key={chaveGrupo}>
                <h2 className="mb-2 font-titulo text-base font-bold text-texto-2">{rotulo}</h2>
                <Cartao className="p-0">
                  <ul className="divide-y divide-borda">
                    {daCategoria.map((p) =>
                      ehMaster ? (
                        <LinhaProdutoEditavel key={p.id} slug={slug} produto={p} categorias={categorias.data ?? []} />
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
              </section>
            ))}
          </div>
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
                  <LinhaProdutoEditavel key={p.id} slug={slug} produto={p} categorias={categorias.data ?? []} />
                ))}
              </ul>
            </Cartao>
          </section>
        )}
      </div>
    </>
  );
}

function CategoriasProduto({ slug, categorias }: { slug: string; categorias: CategoriaProduto[] }) {
  const [nome, setNome] = useState("");
  const [erroExclusao, setErroExclusao] = useState<string>();
  const criar = useMutation({
    mutationFn: (nome: string) => api.post<CategoriaProduto>(daEmpresa(slug, "/produtos/categorias"), { nome }),
    onSuccess: () => {
      setNome("");
      return recarregar(slug);
    },
  });
  const excluir = useMutation({
    mutationFn: (id: string) => api.delete<{ sucesso: string }>(daEmpresa(slug, `/produtos/categorias/${id}`)),
    onSuccess: () => recarregar(slug),
    onError: (e) => setErroExclusao(e instanceof ErroApi ? e.message : "Não foi possível excluir."),
  });

  return (
    <div className="mt-3 flex flex-col gap-3">
      {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}
      {erroExclusao && <Aviso tipo="erro">{erroExclusao}</Aviso>}
      {categorias.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-borda-forte bg-superficie py-1 pl-3.5 pr-1.5 text-sm font-semibold"
            >
              {c.nome}
              <button
                type="button"
                onClick={() => {
                  setErroExclusao(undefined);
                  if (window.confirm(`Excluir a categoria "${c.nome}"?`)) excluir.mutate(c.id);
                }}
                disabled={excluir.isPending}
                aria-label={`Excluir categoria ${c.nome}`}
                className="flex size-6 items-center justify-center rounded-full text-texto-3 hover:bg-superficie-2 hover:text-erro"
              >
                <IconeFechar tamanho={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (nome.trim()) criar.mutate(nome.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da nova categoria"
          aria-label="Nome da nova categoria"
          className="min-h-11 w-full max-w-64 rounded-xl border border-borda-forte bg-superficie px-3.5 text-base focus:border-mel md:text-[15px]"
        />
        <Botao type="submit" variante="secundario" disabled={criar.isPending || !nome.trim()} className="shrink-0">
          <IconeMais tamanho={16} /> {criar.isPending ? "Criando…" : "Criar categoria"}
        </Botao>
      </form>
    </div>
  );
}

function CampoCategoria({ categorias, defaultValue }: { categorias: CategoriaProduto[]; defaultValue?: string }) {
  return (
    <Selecao rotulo="Categoria" name="categoriaId" defaultValue={defaultValue} required>
      {categorias.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </Selecao>
  );
}

function CampoUnidade({ defaultValue }: { defaultValue?: string }) {
  return (
    <Campo rotulo="Unidade" name="unidade" defaultValue={defaultValue} placeholder="pote 1 kg" list="unidades-sugeridas" autoComplete="off" required />
  );
}

function FormularioNovoProduto({ slug, categorias }: { slug: string; categorias: CategoriaProduto[] }) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome" name="nome" placeholder="Mel silvestre" required />
        <CampoCategoria categorias={categorias} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CampoUnidade />
        <Campo rotulo="Preço sugerido (R$)" name="preco" inputMode="decimal" placeholder="45,00" required />
      </div>
      <datalist id="unidades-sugeridas">
        {UNIDADES_SUGERIDAS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div>
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? "Adicionando…" : "Adicionar produto"}
        </Botao>
      </div>
    </form>
  );
}

function LinhaProdutoEditavel({ slug, produto, categorias }: { slug: string; produto: Produto; categorias: CategoriaProduto[] }) {
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome" name="nome" defaultValue={produto.nome} required />
            <CampoCategoria categorias={categorias} defaultValue={produto.categoria?.id} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CampoUnidade defaultValue={produto.unidade} />
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
        {!produto.ativo && produto.categoria && <p className="mt-0.5 text-sm text-texto-3">{produto.categoria.nome}</p>}
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
