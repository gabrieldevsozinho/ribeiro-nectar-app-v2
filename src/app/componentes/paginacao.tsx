import { Link } from "react-router";
import { IconeSeta, IconeVoltar } from "./icones";

/** Paginação por links (?pagina=N), mantendo os outros filtros da URL. */
export function Paginacao({
  pagina,
  paginas,
  hrefBase,
  filtros = {},
}: {
  pagina: number;
  paginas: number;
  hrefBase: string;
  filtros?: Record<string, string | undefined>;
}) {
  if (paginas <= 1) return null;

  const href = (numero: number) => {
    const busca = new URLSearchParams();
    Object.entries(filtros).forEach(([chave, valor]) => valor && busca.set(chave, valor));
    if (numero > 1) busca.set("pagina", String(numero));
    const texto = busca.toString();
    return texto ? `${hrefBase}?${texto}` : hrefBase;
  };

  const botao =
    "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borda-forte px-3 text-sm font-semibold hover:bg-superficie-2";
  const desativado = "inline-flex min-h-10 items-center gap-1 rounded-xl border border-borda px-3 text-sm text-texto-3";

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Paginação">
      {pagina > 1 ? (
        <Link to={href(pagina - 1)} className={botao} preventScrollReset>
          <IconeVoltar tamanho={16} /> Anterior
        </Link>
      ) : (
        <span className={desativado}>
          <IconeVoltar tamanho={16} /> Anterior
        </span>
      )}
      <span className="text-sm text-texto-2">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link to={href(pagina + 1)} className={botao} preventScrollReset>
          Próxima <IconeSeta tamanho={16} />
        </Link>
      ) : (
        <span className={desativado}>
          Próxima <IconeSeta tamanho={16} />
        </span>
      )}
    </nav>
  );
}
