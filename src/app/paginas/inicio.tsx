import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { normalizarSlug } from "@/compartilhado/slug";
import type { UltimaEmpresa } from "@/compartilhado/tipos";
import { api } from "../api";
import { Marca } from "../componentes/marca";
import { Botao, BotaoLink, Carregando, useTitulo } from "../componentes/ui";

export default function PaginaInicial() {
  useTitulo("");
  const [busca] = useSearchParams();
  const ultima = useQuery({
    queryKey: ["publico", "ultima-empresa"],
    queryFn: () => api.get<UltimaEmpresa>("/api/publico/ultima-empresa"),
  });

  // App instalado (start_url "/?origem=app"): abre direto na última empresa usada neste aparelho.
  if (busca.get("origem") === "app") {
    if (ultima.isPending) return <Carregando />;
    if (ultima.data) return <Navigate to={`/${ultima.data.slug}`} replace />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8 md:px-8">
      <header>
        <Marca />
      </header>

      <section className="flex flex-1 flex-col justify-center gap-10 py-14 md:flex-row md:items-center md:gap-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mel-texto">Gestão de vendas para empresas de mel</p>
          <h1 className="mt-3 font-titulo text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
            Saiba o que foi vendido, quando, para quem e por quem.
          </h1>
          <p className="mt-4 text-lg text-texto-2">
            Seus revendedores registram as vendas pelo celular e você acompanha tudo em tempo real, com o mapa dos comércios
            atendidos.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-[var(--radius-cartao)] border border-borda bg-superficie p-6 shadow-sm">
          <h2 className="font-titulo text-xl font-bold">Acessar minha empresa</h2>
          <p className="mt-1 text-sm text-texto-2">Digite o endereço da sua empresa no Ribeiro Néctar.</p>
          {ultima.data && (
            <BotaoLink to={`/${ultima.data.slug}`} className="mt-5 w-full">
              Continuar em {ultima.data.nome}
            </BotaoLink>
          )}
          <IrParaEmpresa />
        </div>
      </section>

      <footer className="text-sm text-texto-3">Desenvolvido por Gabriel Studio</footer>
    </main>
  );
}

function IrParaEmpresa() {
  const navegar = useNavigate();
  const [valor, setValor] = useState("");
  const slug = normalizarSlug(valor);

  return (
    <form
      className="mt-5 flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (slug) navegar(`/${slug}/login`);
      }}
    >
      <label htmlFor="empresa" className="text-sm font-semibold">
        Endereço da empresa
      </label>
      <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-borda-forte bg-superficie focus-within:border-mel">
        <span className="pl-3.5 text-base text-texto-3 md:text-[15px]">ribeironectar.com.br/</span>
        <input
          id="empresa"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="sua-empresa"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-base outline-none md:text-[15px]"
        />
      </div>
      <Botao type="submit" disabled={!slug}>
        Continuar
      </Botao>
    </form>
  );
}
