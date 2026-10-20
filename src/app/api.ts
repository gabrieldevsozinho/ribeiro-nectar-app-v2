/**
 * Chamadas à API do Worker. Toda resposta de erro vem como { erro, motivo? }:
 * erros de acesso (motivo) mandam o usuário para a tela certa (veja tratarErroDeAcesso);
 * os outros viram mensagem na própria tela.
 */
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import type { MotivoAcesso, RespostaErro } from "@/compartilhado/tipos";

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly motivo?: MotivoAcesso,
    readonly corpo?: Record<string, unknown>,
  ) {
    super(mensagem);
  }
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: "same-origin",
    });
  } catch {
    throw new ErroApi("Sem conexão com a internet. Confira e tente de novo.", 0);
  }
  const dados = (await resposta.json().catch(() => null)) as (RespostaErro & Record<string, unknown>) | null;
  if (!resposta.ok) {
    throw new ErroApi(dados?.erro ?? "Não foi possível concluir. Tente de novo.", resposta.status, dados?.motivo, dados ?? undefined);
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>("POST", caminho, corpo ?? {}),
  put: <T>(caminho: string, corpo: unknown) => requisitar<T>("PUT", caminho, corpo),
  patch: <T>(caminho: string, corpo: unknown) => requisitar<T>("PATCH", caminho, corpo),
  delete: <T>(caminho: string) => requisitar<T>("DELETE", caminho),
};

/** Endereço de uma rota da área da empresa. */
export const daEmpresa = (slug: string, caminho: string) => `/api/e/${slug}${caminho}`;

/** Chave das consultas de uma empresa: invalidar ["e", slug] recarrega tudo dela. */
export const chave = (slug: string, ...partes: unknown[]) => ["e", slug, ...partes];

/** Navegação definida pelo roteador (main.tsx), usada fora dos componentes. */
let navegar: (destino: string) => void = (destino) => window.location.assign(destino);
export function definirNavegacao(funcao: (destino: string) => void) {
  navegar = funcao;
}

/** Erro de acesso → tela certa: login (com motivo), primeiro acesso, painel do admin… */
export function tratarErroDeAcesso(erro: unknown) {
  if (!(erro instanceof ErroApi) || !erro.motivo) return;
  const caminho = window.location.pathname;
  const naAreaAdmin = caminho.startsWith("/admin");
  const slug = caminho.split("/")[1] ?? "";
  const login = naAreaAdmin ? "/admin/login" : `/${slug}/login`;

  switch (erro.motivo) {
    case "anonimo":
      if (!caminho.endsWith("/login")) navegar(login);
      break;
    case "trocar-senha":
      navegar(`/${slug}/primeiro-acesso`);
      break;
    case "admin":
      navegar("/admin/empresas");
      break;
    case "so-master":
      navegar(`/${slug}/vendas`);
      break;
    default:
      // bloqueado, excluido, empresa-inativa, outra-empresa, sem-permissao: a API já encerrou a sessão.
      fila.clear();
      navegar(`${login}?motivo=${erro.motivo}`);
  }
}

export const fila = new QueryClient({
  queryCache: new QueryCache({ onError: tratarErroDeAcesso }),
  mutationCache: new MutationCache({ onError: tratarErroDeAcesso }),
  defaultOptions: {
    queries: {
      // Erros de acesso e "não encontrado" não adiantam repetir.
      retry: (tentativas, erro) => !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && tentativas < 2,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Lê um formulário como objeto de textos. */
export function lerFormulario(formulario: HTMLFormElement): Record<string, string> {
  return Object.fromEntries([...new FormData(formulario).entries()].map(([nome, valor]) => [nome, String(valor)]));
}

/** Mensagem de erro de qualquer exceção, para mostrar na tela. */
export function mensagemDe(erro: unknown): string | undefined {
  if (!erro) return undefined;
  return erro instanceof Error ? erro.message : "Não foi possível concluir. Tente de novo.";
}
