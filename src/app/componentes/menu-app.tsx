import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api, fila } from "../api";
import { Marca } from "./marca";
import { IconeFechar, IconeMenu, IconeSair } from "./icones";

export type ItemMenu = { href: string; rotulo: string; icone: ReactNode; destaque?: boolean };

type Props = {
  itens: ItemMenu[];
  titulo: string;
  subtitulo: string;
  nomeUsuario: string;
  /** Para onde ir depois de sair (com ?motivo=saiu). */
  destinoAoSair: string;
};

/** Encerra a sessão, esquece os dados em cache e volta para o login. */
export function useSair(destino: string) {
  const navegar = useNavigate();
  return async () => {
    await api.post("/api/sessao/sair").catch(() => undefined);
    fila.clear();
    navegar(destino, { replace: true });
  };
}

export function MenuApp({ itens, titulo, subtitulo, nomeUsuario, destinoAoSair }: Props) {
  const caminho = useLocation().pathname;
  const sair = useSair(destinoAoSair);
  // Guarda em qual página o menu do celular foi aberto: ao navegar, ele fecha sozinho.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === caminho;
  const setAberto = (valor: boolean) => setAbertoEm(valor ? caminho : null);

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Marca tamanho="p" />
        <div className="mt-5 rounded-xl bg-superficie-2 px-3.5 py-3">
          <p className="truncate text-sm font-bold text-texto">{titulo}</p>
          <p className="truncate text-xs text-texto-2">{subtitulo}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Menu principal">
        <ul className="flex flex-col gap-0.5">
          {itens.map((item) => {
            const ativo = caminho === item.href || (item.href !== itens[0].href && caminho.startsWith(item.href + "/"));
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${
                    ativo
                      ? "bg-mel-claro text-mel-texto"
                      : item.destaque
                        ? "text-texto hover:bg-superficie-2"
                        : "text-texto-2 hover:bg-superficie-2 hover:text-texto"
                  }`}
                >
                  <span className={ativo || item.destaque ? "text-mel-texto" : "text-texto-3"}>{item.icone}</span>
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-borda px-3 py-3">
        <p className="truncate px-3 pb-1 text-xs text-texto-3">{nomeUsuario}</p>
        <button
          type="button"
          onClick={sair}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-texto-2 hover:bg-superficie-2 hover:text-texto"
        >
          <IconeSair className="text-texto-3" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Celular: barra no topo + gaveta */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-borda bg-fundo/95 px-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex size-11 items-center justify-center rounded-xl text-texto hover:bg-superficie-2"
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <IconeMenu />
        </button>
        <span className="truncate px-2 text-sm font-bold">{titulo}</span>
        <span className="size-11" />
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-80 bg-superficie shadow-xl">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="absolute top-4 right-3 flex size-10 items-center justify-center rounded-xl text-texto-2 hover:bg-superficie-2"
              aria-label="Fechar menu"
            >
              <IconeFechar />
            </button>
            {conteudo}
          </div>
        </div>
      )}

      {/* Computador: barra lateral fixa */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-borda bg-superficie md:block">
        {conteudo}
      </aside>
    </>
  );
}

export function MenuEsqueleto() {
  return (
    <>
      <div className="h-14 border-b border-borda md:hidden" />
      <aside className="hidden h-dvh w-64 shrink-0 border-r border-borda bg-superficie md:block" />
    </>
  );
}
