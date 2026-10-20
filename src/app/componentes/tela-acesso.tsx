import type { ReactNode } from "react";
import { Link } from "react-router";
import { Marca } from "./marca";

/** Moldura das telas sem login (entrar, primeiro acesso). */
export function TelaAcesso({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8" aria-label="Ribeiro Néctar">
        <Marca />
      </Link>
      <div className="w-full max-w-sm rounded-[var(--radius-cartao)] border border-borda bg-superficie p-6 shadow-sm">
        {children}
      </div>
      {rodape && <div className="mt-6 text-center text-sm text-texto-3">{rodape}</div>}
    </main>
  );
}
