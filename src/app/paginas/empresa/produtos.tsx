import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import type { CategoriaProduto, Produto, UnidadeProduto } from "@/compartilhado/tipos";
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
  const unidades = useQuery({
    queryKey: chave(slug, "produtos", "unidades"),
    queryFn: () => api.get<UnidadeProduto[]>(daEmpresa(slug, "/produtos/unidades")),
    enabled: ehMaster,
  });

  const ativos = porCategoria((produtos.data ?? []).filter((p) => p.ativo));
  const inativos = (produtos.data ?? []).filter((p) => !p.ativo);

  const cadastrosProntos = Boolean(categorias.data && unidades.data);
  const semCadastros = cadastrosProntos && categorias.data!.length === 0;
  const semUnidades = cadastrosProntos && unidades.data!.length === 0;

  return (
    <>
      <TituloPagina
        titulo="Produtos"
        descricao="Catálogo da empresa, organizado por linha (mel, própolis, pólen…). Na venda, o revendedor escolhe daqui e o preço sugerido já vem preenchido."
      />
      <div className="flex max-w-3xl flex-col gap-5">
        {ehMaster && (
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Categorias e unidades</h2>
            <p className="mt-1 text-sm text-texto-2">
              Linhas do catálogo (mel, própolis…) e tamanhos (pote 1 kg, frasco 30 ml…). Crie as suas ou exclua as que não usa.
            </p>
            {categorias.isError ? (
              <ErroCarregar erro={categorias.error} aoTentar={() => categorias.refetch()} />
            ) : unidades.isError ? (
              <ErroCarregar erro={unidades.error} aoTentar={() => unidades.refetch()} />
            ) : !categorias.data || !unidades.data ? (
              <Carregando />
            ) : (
              <GerenciarCadastros slug={slug} categorias={categorias.data} unidades={unidades.data} />
            )}
          </Cartao>
        )}

        {ehMaster && (
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Novo produto</h2>
            {!cadastrosProntos ? (
              <Carregando />
            ) : semCadastros ? (
              <p className="mt-3 text-sm text-texto-2">Crie uma categoria acima antes de cadastrar o primeiro produto.</p>
            ) : semUnidades ? (
              <p className="mt-3 text-sm text-texto-2">Crie uma unidade acima antes de cadastrar o primeiro produto.</p>
            ) : (
              <FormularioNovoProduto slug={slug} categorias={categorias.data ?? []} unidades={unidades.data ?? []} />
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
                        <LinhaProdutoEditavel
                          key={p.id}
                          slug={slug}
                          produto={p}
                          categorias={categorias.data ?? []}
                          unidades={unidades.data ?? []}
                        />
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
                  <LinhaProdutoEditavel
                    key={p.id}
                    slug={slug}
                    produto={p}
                    categorias={categorias.data ?? []}
                    unidades={unidades.data ?? []}
                  />
                ))}
              </ul>
            </Cartao>
          </section>
        )}
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Pop-ups de categorias e unidades
// -----------------------------------------------------------------------------
type TelaCadastros = null | "nova-categoria" | "nova-unidade" | "ver-cadastradas";

function GerenciarCadastros({
  slug,
  categorias,
  unidades,
}: {
  slug: string;
  categorias: CategoriaProduto[];
  unidades: UnidadeProduto[];
}) {
  const [tela, setTela] = useState<TelaCadastros>(null);
  const fechar = () => setTela(null);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Botao type="button" variante="primario" onClick={() => setTela("nova-categoria")}>
        <IconeMais tamanho={16} /> Nova categoria
      </Botao>
      <Botao type="button" variante="primario" onClick={() => setTela("nova-unidade")}>
        <IconeMais tamanho={16} /> Nova unidade
      </Botao>
      <Botao type="button" variante="secundario" onClick={() => setTela("ver-cadastradas")}>
        Ver cadastradas
      </Botao>

      {tela === "nova-categoria" && (
        <PopupNovoCadastro
          slug={slug}
          titulo="Nova categoria"
          descricao="Linha do catálogo (mel, própolis, pólen…)."
          rotulo="Nome da categoria"
          placeholder="Ex.: Mel"
          caminho="/produtos/categorias"
          aoFechar={fechar}
        />
      )}
      {tela === "nova-unidade" && (
        <PopupNovoCadastro
          slug={slug}
          titulo="Nova unidade"
          descricao="Tamanho do produto (pote 1 kg, frasco 30 ml…)."
          rotulo="Nome da unidade"
          placeholder="Ex.: pote 1 kg"
          caminho="/produtos/unidades"
          aoFechar={fechar}
        />
      )}
      {tela === "ver-cadastradas" && (
        <PopupVerCadastradas slug={slug} categorias={categorias} unidades={unidades} aoFechar={fechar} />
      )}
    </div>
  );
}

/** Diálogo nativo do navegador (<dialog>): fecha ao clicar fora, Esc fecha, e já vem acessível. */
function Popup({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
      className="m-auto max-h-[90dvh] w-[min(520px,calc(100vw-24px))] overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-fundo p-0 text-texto shadow-2xl backdrop:bg-black/45"
      aria-labelledby="popup-titulo"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-borda bg-superficie px-5 py-4">
          <h2 id="popup-titulo" className="min-w-0 flex-1 font-titulo text-xl font-bold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-texto-2 hover:bg-superficie-2"
            aria-label="Fechar"
          >
            <IconeFechar />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}

function PopupNovoCadastro({
  slug,
  titulo,
  descricao,
  rotulo,
  placeholder,
  caminho,
  aoFechar,
}: {
  slug: string;
  titulo: string;
  descricao: string;
  rotulo: string;
  placeholder: string;
  caminho: string;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const criar = useMutation({
    mutationFn: (nome: string) => api.post<{ id: string; nome: string }>(daEmpresa(slug, caminho), { nome }),
    onSuccess: async () => {
      await recarregar(slug);
      aoFechar();
    },
  });
  return (
    <Popup titulo={titulo} aoFechar={aoFechar}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (nome.trim()) criar.mutate(nome.trim());
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-texto-2">{descricao}</p>
        {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}
        <Campo
          rotulo={rotulo}
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholder}
          autoFocus
          autoComplete="off"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao type="button" variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={criar.isPending || !nome.trim()}>
            {criar.isPending ? "Criando…" : "Criar"}
          </Botao>
        </div>
      </form>
    </Popup>
  );
}

function PopupVerCadastradas({
  slug,
  categorias,
  unidades,
  aoFechar,
}: {
  slug: string;
  categorias: CategoriaProduto[];
  unidades: UnidadeProduto[];
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string>();
  return (
    <Popup titulo="Categorias e unidades" aoFechar={aoFechar}>
      <div className="flex flex-col gap-5">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <ListaExcluivel
          slug={slug}
          itens={categorias}
          caminho="/produtos/categorias"
          titulo="Categorias"
          vazio="Nenhuma categoria cadastrada."
          confirmar={(nome) => `Excluir a categoria "${nome}"?`}
          aoErro={setErro}
          aoLimparErro={() => setErro(undefined)}
        />
        <ListaExcluivel
          slug={slug}
          itens={unidades}
          caminho="/produtos/unidades"
          titulo="Unidades"
          vazio="Nenhuma unidade cadastrada."
          confirmar={(nome) => `Excluir a unidade "${nome}"?`}
          aoErro={setErro}
          aoLimparErro={() => setErro(undefined)}
        />
      </div>
    </Popup>
  );
}

function ListaExcluivel({
  slug,
  itens,
  caminho,
  titulo,
  vazio,
  confirmar,
  aoErro,
  aoLimparErro,
}: {
  slug: string;
  itens: { id: string; nome: string }[];
  caminho: string;
  titulo: string;
  vazio: string;
  confirmar: (nome: string) => string;
  aoErro: (mensagem: string) => void;
  aoLimparErro: () => void;
}) {
  const excluir = useMutation({
    mutationFn: (id: string) => api.delete<{ sucesso: string }>(daEmpresa(slug, `${caminho}/${id}`)),
    onSuccess: () => recarregar(slug),
    onError: (e) => aoErro(e instanceof ErroApi ? e.message : "Não foi possível excluir."),
  });
  return (
    <div>
      <h3 className="mb-2 font-titulo text-base font-bold text-texto-2">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-texto-3">{vazio}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {itens.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-1.5 rounded-full border border-borda-forte bg-superficie py-1 pl-3.5 pr-1.5 text-sm font-semibold"
            >
              {i.nome}
              <button
                type="button"
                onClick={() => {
                  aoLimparErro();
                  if (window.confirm(confirmar(i.nome))) excluir.mutate(i.id);
                }}
                disabled={excluir.isPending}
                aria-label={`Excluir ${i.nome}`}
                className="flex size-6 items-center justify-center rounded-full text-texto-3 hover:bg-superficie-2 hover:text-erro"
              >
                <IconeFechar tamanho={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Formulário de produto (criação e edição)
// -----------------------------------------------------------------------------
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

/**
 * Dropdown real (select) com as unidades cadastradas da empresa. Se o produto já tinha uma unidade
 * fora da lista (por ex. um produto antigo), ela aparece no topo para o master poder manter.
 */
function CampoUnidade({ unidades, defaultValue }: { unidades: UnidadeProduto[]; defaultValue?: string }) {
  const temDefault = defaultValue && unidades.every((u) => u.nome !== defaultValue);
  return (
    <Selecao rotulo="Unidade" name="unidade" defaultValue={defaultValue ?? ""} required>
      {!defaultValue && (
        <option value="" disabled>
          Escolha a unidade
        </option>
      )}
      {temDefault && <option value={defaultValue}>{defaultValue} (atual)</option>}
      {unidades.map((u) => (
        <option key={u.id} value={u.nome}>
          {u.nome}
        </option>
      ))}
    </Selecao>
  );
}

function FormularioNovoProduto({
  slug,
  categorias,
  unidades,
}: {
  slug: string;
  categorias: CategoriaProduto[];
  unidades: UnidadeProduto[];
}) {
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
        <CampoUnidade unidades={unidades} />
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

function LinhaProdutoEditavel({
  slug,
  produto,
  categorias,
  unidades,
}: {
  slug: string;
  produto: Produto;
  categorias: CategoriaProduto[];
  unidades: UnidadeProduto[];
}) {
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
            <CampoUnidade unidades={unidades} defaultValue={produto.unidade} />
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
