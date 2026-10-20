import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router";

function juntar(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Título da aba do navegador. */
export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Ribeiro Néctar` : "Ribeiro Néctar";
  }, [titulo]);
}

// -----------------------------------------------------------------------------
// Botões
// -----------------------------------------------------------------------------
type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const BOTAO_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-[15px] font-semibold " +
  "transition-colors disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap";

const BOTAO_VARIANTE: Record<Variante, string> = {
  primario: "bg-mel text-sobre-mel hover:bg-mel-forte",
  secundario: "bg-superficie text-texto border border-borda-forte hover:bg-superficie-2",
  perigo: "bg-erro text-white hover:opacity-90",
  fantasma: "text-texto-2 hover:bg-superficie-2 hover:text-texto",
};

export function Botao({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={juntar(BOTAO_BASE, BOTAO_VARIANTE[variante], className)} {...props} />;
}

export function BotaoLink({
  variante = "primario",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={juntar(BOTAO_BASE, BOTAO_VARIANTE[variante], className)} {...props} />;
}

/** Link "← Voltar" do topo das páginas internas. */
export function LinkVoltar({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link to={para} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-texto-2 hover:text-texto">
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {children}
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Formulários
// -----------------------------------------------------------------------------
export function Campo({
  rotulo,
  dica,
  erro,
  className,
  id,
  name,
  ...props
}: ComponentProps<"input"> & { rotulo: string; dica?: ReactNode; erro?: string }) {
  const idCampo = id ?? name;
  // Campos de senha ganham o botão "mostrar / ocultar".
  const ehSenha = props.type === "password";
  const [mostrar, setMostrar] = useState(false);
  const campo = (
    <input
      id={idCampo}
      name={name}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? `${idCampo}-erro` : undefined}
      className={juntar(
        "min-h-11 w-full rounded-xl border bg-superficie px-3.5 text-base text-texto placeholder:text-texto-3 md:text-[15px]",
        ehSenha && "pr-12",
        erro ? "border-erro" : "border-borda-forte focus:border-mel",
      )}
      {...props}
      type={ehSenha && mostrar ? "text" : props.type}
    />
  );
  return (
    <div className={juntar("flex flex-col gap-1.5", className)}>
      <label htmlFor={idCampo} className="text-sm font-semibold text-texto">
        {rotulo}
      </label>
      {ehSenha ? (
        <div className="relative">
          {campo}
          <button
            type="button"
            onClick={() => setMostrar((m) => !m)}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrar}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-texto-3 hover:text-texto"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {mostrar && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
      ) : (
        campo
      )}
      {erro ? (
        <p id={`${idCampo}-erro`} className="text-sm text-erro">
          {erro}
        </p>
      ) : (
        dica && <p className="text-sm text-texto-3">{dica}</p>
      )}
    </div>
  );
}

export function Selecao({
  rotulo,
  erro,
  className,
  id,
  name,
  children,
  ...props
}: ComponentProps<"select"> & { rotulo: string; erro?: string }) {
  const idCampo = id ?? name;
  return (
    <div className={juntar("flex flex-col gap-1.5", className)}>
      <label htmlFor={idCampo} className="text-sm font-semibold text-texto">
        {rotulo}
      </label>
      <select
        id={idCampo}
        name={name}
        aria-invalid={erro ? true : undefined}
        className={juntar(
          "min-h-11 rounded-xl border bg-superficie px-3 text-base text-texto md:text-[15px]",
          erro ? "border-erro" : "border-borda-forte focus:border-mel",
        )}
        {...props}
      >
        {children}
      </select>
      {erro && <p className="text-sm text-erro">{erro}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Blocos
// -----------------------------------------------------------------------------
export function Cartao({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={juntar("rounded-[var(--radius-cartao)] border border-borda bg-superficie p-5", className)}
      {...props}
    />
  );
}

type TipoAviso = "info" | "sucesso" | "erro" | "alerta";

const AVISO_ESTILO: Record<TipoAviso, string> = {
  info: "bg-info-claro text-info border-info/25",
  sucesso: "bg-sucesso-claro text-sucesso border-sucesso/25",
  erro: "bg-erro-claro text-erro border-erro/25",
  alerta: "bg-alerta-claro text-alerta border-alerta/30",
};

export function Aviso({
  tipo = "info",
  titulo,
  children,
  className,
}: {
  tipo?: TipoAviso;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={juntar("rounded-xl border px-4 py-3 text-sm", AVISO_ESTILO[tipo], className)}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className={titulo ? "mt-0.5 opacity-95" : undefined}>{children}</div>}
    </div>
  );
}

type TipoSelo = "neutro" | "mel" | "sucesso" | "erro" | "alerta";

const SELO_ESTILO: Record<TipoSelo, string> = {
  neutro: "bg-superficie-2 text-texto-2",
  mel: "bg-mel-claro text-mel-texto",
  sucesso: "bg-sucesso-claro text-sucesso",
  erro: "bg-erro-claro text-erro",
  alerta: "bg-alerta-claro text-alerta",
};

export function Selo({ tipo = "neutro", children }: { tipo?: TipoSelo; children: ReactNode }) {
  return (
    <span
      className={juntar(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        SELO_ESTILO[tipo],
      )}
    >
      {children}
    </span>
  );
}

export function TituloPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-titulo text-2xl font-bold tracking-tight text-texto md:text-[28px]">{titulo}</h1>
        {descricao && <div className="mt-1 text-texto-2">{descricao}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-texto-2" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-mel border-t-transparent" />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-cartao)] border border-dashed border-borda-forte px-6 py-10 text-center">
      <p className="font-semibold text-texto">{titulo}</p>
      {children && <div className="mt-1 text-sm text-texto-2">{children}</div>}
    </div>
  );
}

/** Erro ao carregar uma tela (sem conexão, servidor fora…). Erros de acesso já redirecionam. */
export function ErroCarregar({ erro, aoTentar }: { erro: unknown; aoTentar?: () => void }) {
  const naoEncontrado = (erro as { status?: number })?.status === 404;
  return (
    <Vazio titulo={naoEncontrado ? "Não encontrado" : "Não foi possível carregar"}>
      {naoEncontrado ? "Este registro não existe ou você não tem acesso a ele." : (erro as Error)?.message}
      {aoTentar && !naoEncontrado && (
        <div className="mt-3">
          <Botao type="button" variante="secundario" onClick={aoTentar}>
            Tentar de novo
          </Botao>
        </div>
      )}
    </Vazio>
  );
}
