import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { tamanho?: number };

function Base({ tamanho = 20, children, ...props }: Props) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeVendas = (p: Props) => (
  <Base {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Base>
);
export const IconeMais = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconeMapa = (p: Props) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Base>
);
export const IconeLoja = (p: Props) => (
  <Base {...p}>
    <path d="M4 9.5 5.5 4h13L20 9.5" />
    <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
    <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
  </Base>
);
export const IconePote = (p: Props) => (
  <Base {...p}>
    <path d="M8 3h8M7 6h10" />
    <path d="M7 6c-1.7 1-2.5 2.6-2.5 4.5V18a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-7.5C19.5 8.6 18.7 7 17 6" />
    <path d="M8.5 14h7" />
  </Base>
);
export const IconePessoas = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.6A5.5 5.5 0 0 1 20.5 20" />
  </Base>
);
export const IconeEngrenagem = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Base>
);
export const IconePessoa = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20.5a7 7 0 0 1 14 0" />
  </Base>
);
export const IconeSair = (p: Props) => (
  <Base {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </Base>
);
export const IconeMenu = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);
export const IconeFechar = (p: Props) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IconePredio = (p: Props) => (
  <Base {...p}>
    <path d="M4 21V5l8-2v18M12 8h8v13" />
    <path d="M7.5 8h1M7.5 12h1M7.5 16h1M15.5 12h1M15.5 16h1" />
  </Base>
);
export const IconeSeta = (p: Props) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
);
export const IconeVoltar = (p: Props) => (
  <Base {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Base>
);
export const IconeAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M12 3 2.5 20h19z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Base>
);
