type Props = {
  tamanho?: "p" | "m" | "g";
  /** Mostra o nome ao lado do símbolo. */
  comNome?: boolean;
};

const DIMENSOES = { p: 26, m: 32, g: 44 } as const;

export function SimboloMarca({ tamanho = "m" }: { tamanho?: Props["tamanho"] }) {
  const lado = DIMENSOES[tamanho];
  return (
    <svg width={lado} height={lado} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="var(--color-mel)" />
      <path
        d="M16 9.2c-2.6 3-4.4 5.6-4.4 7.6a4.4 4.4 0 0 0 8.8 0c0-2-1.8-4.6-4.4-7.6Z"
        fill="var(--color-sobre-mel)"
        opacity=".85"
      />
    </svg>
  );
}

export function Marca({ tamanho = "m", comNome = true }: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <SimboloMarca tamanho={tamanho} />
      {comNome && (
        <span
          className={`font-titulo font-extrabold tracking-tight text-texto ${
            tamanho === "g" ? "text-2xl" : tamanho === "m" ? "text-lg" : "text-base"
          }`}
        >
          Ribeiro <span className="text-mel-texto">Néctar</span>
        </span>
      )}
    </span>
  );
}
