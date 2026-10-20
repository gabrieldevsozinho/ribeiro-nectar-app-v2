import { useState, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { normalizarSlug } from "@/compartilhado/slug";
import type { UltimaEmpresa } from "@/compartilhado/tipos";
import { api } from "../api";
import { Marca } from "../componentes/marca";
import { IconeAlerta, IconeLoja, IconeMapa, IconePessoas, IconePote, IconeVendas } from "../componentes/icones";
import { Botao, Carregando, useTitulo } from "../componentes/ui";

export default function PaginaInicial() {
  useTitulo("");
  const [busca] = useSearchParams();
  // App instalado (start_url "/?origem=app"): abre direto na última empresa usada neste aparelho.
  // Essa informação nunca aparece na página pública: a página só apresenta o serviço.
  const abrindoComoApp = busca.get("origem") === "app";
  const ultima = useQuery({
    queryKey: ["publico", "ultima-empresa"],
    queryFn: () => api.get<UltimaEmpresa>("/api/publico/ultima-empresa"),
    enabled: abrindoComoApp,
  });

  if (abrindoComoApp) {
    if (ultima.isPending) return <Carregando />;
    if (ultima.data) return <Navigate to={`/${ultima.data.slug}`} replace />;
  }

  return (
    <div className="min-h-dvh">
      <Cabecalho />
      <Heroi />
      <Numeros />
      <Recursos />
      <ComoFunciona />
      <Confianca />
      <ChamadaFinal />
      <Rodape />
    </div>
  );
}

function Cabecalho() {
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <Marca />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-texto-2 md:flex" aria-label="Seções da página">
          <a href="#recursos" className="hover:text-texto">
            O que faz
          </a>
          <a href="#como-funciona" className="hover:text-texto">
            Como funciona
          </a>
          <a href="#seguranca" className="hover:text-texto">
            Segurança
          </a>
        </nav>
        <a
          href="#acessar"
          className="inline-flex min-h-10 items-center rounded-xl border border-borda-forte px-4 text-sm font-semibold hover:bg-superficie-2"
        >
          Entrar
        </a>
      </div>
    </header>
  );
}

function Heroi() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-10 md:px-8 md:py-20">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mel-texto">Gestão de vendas para empresas de mel</p>
        <h1 className="mt-3 font-titulo text-4xl font-extrabold leading-[1.06] tracking-tight md:text-[3.4rem]">
          Saiba o que foi vendido, quando, para quem e por quem.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-texto-2">
          Seus revendedores registram cada venda pelo celular, em poucos toques. Você acompanha tudo num só lugar, com o mapa dos
          comércios que sua empresa atende.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="#acessar"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-mel px-6 text-base font-semibold text-sobre-mel transition-colors hover:bg-mel-forte"
          >
            Acessar minha empresa
          </a>
          <a href="#como-funciona" className="inline-flex min-h-12 items-center px-3 text-base font-semibold text-texto-2 hover:text-texto">
            Ver como funciona →
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-texto-2">
          {["Funciona no celular, sem instalar nada da loja", "Cada empresa vê só os próprios dados", "Histórico de vendas que ninguém apaga"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-mel" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto w-full max-w-md md:max-w-none">
        <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-mel-claro opacity-70 blur-2xl" aria-hidden="true" />
        <MockupCelular />
      </div>
    </section>
  );
}

/** Tela de "Nova venda" desenhada em HTML: mostra o que o revendedor vê no celular. */
function MockupCelular() {
  return (
    <div className="mx-auto w-[19rem] rounded-[2.2rem] border-[10px] border-texto bg-texto p-0 shadow-2xl md:w-[20rem]" aria-hidden="true">
      <div className="overflow-hidden rounded-[1.6rem] bg-fundo">
        <div className="flex h-12 items-center justify-between border-b border-borda px-4">
          <span className="text-sm font-bold">Nova venda</span>
          <span className="text-xs text-texto-3">Sua empresa</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <div className="rounded-xl bg-mel-claro px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-mel-texto">1. Onde foi a venda?</p>
            <p className="mt-0.5 text-sm font-semibold">Empório do Bairro</p>
            <p className="text-xs text-texto-2">Rua das Flores, 120 · Sua Cidade/UF</p>
          </div>
          <div className="rounded-xl border border-borda bg-superficie">
            <p className="px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-texto-3">2. O que foi vendido?</p>
            {[
              ["3 × Mel silvestre", "pote 1 kg", "R$ 135,00"],
              ["2 × Favo de mel", "bandeja 300 g", "R$ 60,00"],
              ["6 × Própolis verde", "frasco 30 ml", "R$ 132,00"],
            ].map(([nome, un, valor]) => (
              <div key={nome} className="flex items-center justify-between gap-2 border-t border-borda px-3 py-2 first:mt-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{nome}</p>
                  <p className="text-[11px] text-texto-3">{un}</p>
                </div>
                <span className="text-sm font-semibold">{valor}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-b-xl bg-superficie-2 px-3 py-2.5">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold">R$ 327,00</span>
            </div>
          </div>
          <div className="rounded-xl bg-mel px-4 py-3 text-center text-sm font-semibold text-sobre-mel">Registrar venda · R$ 327,00</div>
        </div>
      </div>
    </div>
  );
}

function Numeros() {
  const itens = [
    ["3 toques", "para o revendedor registrar uma venda"],
    ["100%", "do histórico de vendas preservado: nada é apagado"],
    ["1 lugar", "para ver vendas, comércios, produtos e mapa"],
  ];
  return (
    <section className="border-y border-borda bg-superficie">
      <dl className="mx-auto grid max-w-6xl gap-6 px-5 py-8 text-center sm:grid-cols-3 md:px-8">
        {itens.map(([numero, texto]) => (
          <div key={numero}>
            <dt className="font-titulo text-3xl font-extrabold text-mel-texto">{numero}</dt>
            <dd className="mt-1 text-sm text-texto-2">{texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Recursos() {
  const recursos: { icone: ReactNode; titulo: string; texto: string }[] = [
    {
      icone: <IconeVendas />,
      titulo: "Venda registrada na hora",
      texto: "Escolhe o comércio, adiciona os produtos e confirma. O preço vem do catálogo e pode ser ajustado na negociação.",
    },
    {
      icone: <IconeMapa />,
      titulo: "Mapa das vendas",
      texto: "Veja no mapa cada comércio atendido, agrupados por cidade. Toque num ponto para ler as vendas, de 10 em 10.",
    },
    {
      icone: <IconePessoas />,
      titulo: "Revendedores sob controle",
      texto: "Cada revendedor tem o próprio login e vê só as próprias vendas. Você bloqueia ou remove quando precisar.",
    },
    {
      icone: <IconeLoja />,
      titulo: "Base de comércios sem repetição",
      texto: "O sistema avisa quando o CNPJ ou o endereço já foram cadastrados, para o mesmo comércio não aparecer duas vezes.",
    },
    {
      icone: <IconePote />,
      titulo: "Catálogo da sua empresa",
      texto: "Cadastre seus produtos, unidades e preços sugeridos. Produto desativado some das vendas novas e fica no histórico.",
    },
    {
      icone: <IconeAlerta />,
      titulo: "Histórico confiável",
      texto: "Vendas e itens só aceitam acréscimo: ninguém altera nem apaga o que já foi vendido. O total é sempre recalculado.",
    },
  ];
  return (
    <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mel-texto">O que faz</p>
        <h2 className="mt-2 font-titulo text-3xl font-extrabold tracking-tight md:text-4xl">
          Tudo o que a venda de mel precisa, sem planilha
        </h2>
        <p className="mt-3 text-lg text-texto-2">Do balcão do revendedor ao painel do dono, com as mesmas informações para todo mundo.</p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recursos.map((r) => (
          <li key={r.titulo} className="rounded-[var(--radius-cartao)] border border-borda bg-superficie p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-mel-claro text-mel-texto">{r.icone}</span>
            <h3 className="mt-4 font-titulo text-lg font-bold">{r.titulo}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-texto-2">{r.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComoFunciona() {
  const passos = [
    ["1", "A empresa é cadastrada", "A Gabriel Studio cria a sua empresa e o acesso do responsável (master), que escolhe a própria senha no primeiro login."],
    ["2", "O master monta a operação", "Cadastra os produtos, os comércios e os revendedores. Cada revendedor recebe um acesso e cria a própria senha."],
    ["3", "A equipe vende e você acompanha", "As vendas entram pelo celular. O master vê tudo por data, vendedor e cidade, e no mapa."],
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-borda bg-superficie">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mel-texto">Como funciona</p>
        <h2 className="mt-2 font-titulo text-3xl font-extrabold tracking-tight md:text-4xl">Do cadastro à primeira venda</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {passos.map(([n, titulo, texto]) => (
            <li key={n} className="relative rounded-[var(--radius-cartao)] border border-borda bg-fundo p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-mel font-titulo text-lg font-extrabold text-sobre-mel">{n}</span>
              <h3 className="mt-4 font-titulo text-lg font-bold">{titulo}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-texto-2">{texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-cartao)] border border-borda bg-fundo p-6">
            <h3 className="font-titulo text-lg font-bold">Master</h3>
            <p className="mt-1 text-sm text-texto-2">O responsável pela empresa</p>
            <ul className="mt-4 flex flex-col gap-2 text-[15px]">
              {["Vê as vendas de toda a equipe", "Cadastra produtos, comércios e revendedores", "Bloqueia ou remove revendedores", "Configura o mapa da empresa"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-mel" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[var(--radius-cartao)] border border-borda bg-fundo p-6">
            <h3 className="font-titulo text-lg font-bold">Revendedor</h3>
            <p className="mt-1 text-sm text-texto-2">Quem vende na rua</p>
            <ul className="mt-4 flex flex-col gap-2 text-[15px]">
              {["Registra vendas em poucos toques", "Acrescenta itens se o comércio pedir mais", "Cadastra comércios novos", "Vê só as próprias vendas"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-mel" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Confianca() {
  const itens = [
    ["Dados separados por empresa", "Os dados de uma empresa nunca aparecem para outra, e cada pessoa só enxerga o que o papel dela permite."],
    ["Senha só de quem usa", "O revendedor cria a própria senha no primeiro acesso. Nem o master, nem a Gabriel Studio a conhecem."],
    ["Privacidade (LGPD)", "A plataforma não lê as vendas das empresas. Ao remover um revendedor, os dados pessoais saem e as vendas ficam no histórico."],
    ["Instala como aplicativo", "No celular, dá para adicionar à tela inicial e abrir direto na sua empresa, sem passar por loja de aplicativos."],
  ];
  return (
    <section id="seguranca" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mel-texto">Segurança</p>
        <h2 className="mt-2 font-titulo text-3xl font-extrabold tracking-tight md:text-4xl">Feito para guardar o que importa</h2>
      </div>
      <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {itens.map(([titulo, texto]) => (
          <div key={titulo} className="border-l-2 border-mel pl-5">
            <dt className="font-titulo text-lg font-bold">{titulo}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-texto-2">{texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section id="acessar" className="scroll-mt-20 border-t border-borda bg-mel-claro">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-center md:px-8 md:py-20">
        <div>
          <h2 className="font-titulo text-3xl font-extrabold tracking-tight md:text-4xl">Pronto para acompanhar suas vendas?</h2>
          <p className="mt-3 max-w-lg text-lg text-texto-2">
            Já tem acesso? Digite o endereço da sua empresa ao lado. Quer o sistema para a sua empresa? Fale com a Gabriel Studio.
          </p>
        </div>
        <div className="w-full rounded-[var(--radius-cartao)] border border-borda bg-superficie p-6 shadow-sm">
          <h3 className="font-titulo text-xl font-bold">Acessar minha empresa</h3>
          <p className="mt-1 text-sm text-texto-2">Digite o endereço da sua empresa no Ribeiro Néctar.</p>
          <IrParaEmpresa />
        </div>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-borda bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-texto-3 md:px-8">
        <Marca tamanho="p" />
        <span>Desenvolvido por Gabriel Studio</span>
      </div>
    </footer>
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
