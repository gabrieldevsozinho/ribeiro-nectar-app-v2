import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarMoeda } from "@/compartilhado/formato";
import type { DadosNovaVenda, PontoEscolha } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, mensagemDe } from "../../../api";
import { IconeLoja, IconeMais } from "../../../componentes/icones";
import { Aviso, Botao, Carregando, Cartao, ErroCarregar, TituloPagina, useTitulo } from "../../../componentes/ui";
import { MontadorItens, totalDosItens, type ItemEmMontagem } from "../../../componentes/vendas/montador-itens";
import { useUsuario } from "../contexto";

function endereco(p: PontoEscolha) {
  return `${[p.logradouro, p.numero].filter(Boolean).join(", ")}${p.bairro ? ` · ${p.bairro}` : ""} · ${p.cidade}/${p.uf}`;
}

type Rascunho = { itens: ItemEmMontagem[]; observacao: string };

/**
 * Rascunho da venda guardado na aba do navegador: quem sai para cadastrar um comércio
 * novo volta com os itens já escolhidos. Some quando a venda é registrada.
 */
function useRascunho(slug: string) {
  const chaveRascunho = `rascunho-venda:${slug}`;
  const [rascunho, setRascunho] = useState<Rascunho>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(chaveRascunho) ?? "") as Rascunho;
    } catch {
      return { itens: [], observacao: "" };
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(chaveRascunho, JSON.stringify(rascunho));
    } catch {
      // Sem armazenamento (aba anônima, por exemplo): o rascunho só vale enquanto a tela estiver aberta.
    }
  }, [chaveRascunho, rascunho]);
  const limpar = () => {
    try {
      sessionStorage.removeItem(chaveRascunho);
    } catch {
      // idem
    }
  };
  return [rascunho, setRascunho, limpar] as const;
}

export default function PaginaNovaVenda() {
  useTitulo("Nova venda");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const pontoDaUrl = useSearchParams()[0].get("ponto") ?? "";

  const dados = useQuery({
    queryKey: chave(slug, "vendas", "nova", pontoDaUrl),
    queryFn: () => api.get<DadosNovaVenda>(daEmpresa(slug, `/vendas/nova${pontoDaUrl ? `?ponto=${pontoDaUrl}` : ""}`)),
  });

  return (
    <>
      <TituloPagina titulo="Nova venda" />
      {dados.isError ? (
        <ErroCarregar erro={dados.error} aoTentar={() => dados.refetch()} />
      ) : !dados.data ? (
        <Carregando />
      ) : (
        // A key muda quando o ponto da URL muda (volta do cadastro de comércio): usa o ponto novo.
        <FormularioNovaVenda key={pontoDaUrl} slug={slug} dados={dados.data} />
      )}
    </>
  );
}

function FormularioNovaVenda({ slug, dados }: { slug: string; dados: DadosNovaVenda }) {
  const navegar = useNavigate();
  const [ponto, setPonto] = useState<PontoEscolha | null>(dados.pontoInicial);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [rascunho, setRascunho, limparRascunho] = useRascunho(slug);
  const { itens, observacao } = rascunho;
  const [erro, setErro] = useState<string>();

  // Busca de comércios enquanto digita (com uma pequena espera).
  useEffect(() => {
    const espera = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [busca]);
  const resultados = useQuery({
    queryKey: chave(slug, "pontos", "busca", termo),
    queryFn: () => api.get<PontoEscolha[]>(daEmpresa(slug, `/pontos/busca?termo=${encodeURIComponent(termo)}`)),
    enabled: termo.length >= 2,
  });

  const registrar = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>(daEmpresa(slug, "/vendas"), {
        pontoId: ponto!.id,
        itens: itens.map(({ produtoId, quantidade, precoUnitario }) => ({ produtoId, quantidade, precoUnitario })),
        observacao,
      }),
    onSuccess: ({ id }) => {
      limparRascunho();
      navegar(`/${slug}/vendas/${id}?registrada=1`);
    },
    onError: (e) => setErro(mensagemDe(e)),
  });

  const total = totalDosItens(itens);
  const buscando = busca.trim().length >= 2;
  const lista = buscando ? (resultados.data ?? []) : dados.recentes;

  function confirmar() {
    if (!ponto) return setErro("Escolha o ponto de venda.");
    if (itens.length === 0) return setErro("Adicione pelo menos um item.");
    setErro(undefined);
    registrar.mutate();
  }

  if (dados.produtos.length === 0) {
    return (
      <Aviso tipo="alerta" titulo="O catálogo está vazio">
        Peça ao master da empresa para cadastrar os produtos antes de registrar vendas.
      </Aviso>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5 pb-24 md:pb-0">
      {/* 1. Ponto de venda */}
      <Cartao className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold">1. Onde foi a venda?</h2>
        {ponto ? (
          <div className="flex items-start gap-3 rounded-xl bg-mel-claro px-3.5 py-3">
            <IconeLoja className="mt-0.5 shrink-0 text-mel-texto" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{ponto.nome}</p>
              <p className="text-sm text-texto-2">{endereco(ponto)}</p>
            </div>
            <button type="button" onClick={() => setPonto(null)} className="shrink-0 text-sm font-semibold text-mel-texto underline underline-offset-2">
              Trocar
            </button>
          </div>
        ) : (
          <>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar comércio por nome, rua ou cidade"
              aria-label="Buscar comércio"
              className="min-h-12 rounded-xl border border-borda-forte bg-superficie px-3.5 text-[16px] focus:border-mel"
            />
            {!buscando && dados.recentes.length > 0 && <p className="text-sm font-semibold text-texto-2">Onde você vendeu por último</p>}
            <ul className="flex flex-col gap-2">
              {lista.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPonto(p)} className="w-full rounded-xl border border-borda px-3.5 py-3 text-left hover:border-mel">
                    <span className="block font-semibold">{p.nome}</span>
                    <span className="block text-sm text-texto-2">{endereco(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {buscando && resultados.data?.length === 0 && (
              <p className="text-sm text-texto-2">Nenhum comércio encontrado com “{busca.trim()}”.</p>
            )}
            <Link
              to={`/${slug}/pontos/novo?depois=venda`}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-borda-forte font-semibold hover:bg-superficie-2"
            >
              <IconeMais tamanho={18} /> Cadastrar comércio novo
            </Link>
          </>
        )}
      </Cartao>

      {/* 2. Itens */}
      <Cartao className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold">2. O que foi vendido?</h2>
        <MontadorItens produtos={dados.produtos} itens={itens} aoMudar={(novos) => setRascunho((r) => ({ ...r, itens: novos }))} />
      </Cartao>

      {/* 3. Observação */}
      <Cartao className="flex flex-col gap-2">
        <label htmlFor="observacao" className="font-titulo text-lg font-bold">
          3. Observação <span className="text-sm font-normal text-texto-3">(opcional)</span>
        </label>
        <textarea
          id="observacao"
          value={observacao}
          onChange={(e) => setRascunho((r) => ({ ...r, observacao: e.target.value }))}
          maxLength={500}
          rows={2}
          placeholder="Ex.: pagamento combinado para sexta"
          className="rounded-xl border border-borda-forte bg-superficie px-3.5 py-2.5 text-[16px] focus:border-mel"
        />
      </Cartao>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {/* Confirmação: fixa no rodapé do celular */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Botao type="button" onClick={confirmar} disabled={registrar.isPending} className="w-full md:w-auto">
          {registrar.isPending ? "Registrando…" : `Registrar venda${total > 0 ? ` · ${formatarMoeda(total)}` : ""}`}
        </Botao>
      </div>
    </div>
  );
}
