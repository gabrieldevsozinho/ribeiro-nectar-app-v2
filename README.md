# Ribeiro Néctar (v2 · Cloudflare)

Sistema de gestão de vendas para empresas de mel (SaaS multi-tenant).
Primeiro cliente: Apiário Ribeiro. Desenvolvimento: Gabriel Studio.

Esta é a reescrita da v1 (Next.js + Supabase + Vercel) para rodar inteira na Cloudflare.
As telas, os endereços, as regras de acesso e as mensagens são as mesmas da v1.

## Stack

| Camada | Tecnologia |
|---|---|
| Telas | React 19 + Vite + React Router + TanStack Query + Tailwind 4 |
| API | Hono no Cloudflare Workers |
| Banco | Cloudflare D1 (SQLite) com Drizzle ORM |
| Login | Better Auth (e-mail e senha, sessões no D1, limite de tentativas por IP) |
| Validação | Zod (corpo das requisições) |
| E-mail | Resend (código de exclusão de revendedor) |
| Mapa | Google Maps com a chave de cada empresa, ou OpenStreetMap + Nominatim para testes |
| Testes | Vitest dentro do runtime do Workers (`@cloudflare/vitest-plugin`) e Playwright |

O R2 (arquivos) ainda não é usado: entra na Fase 2, com fotos e comprovantes. Veja o bloco comentado no `wrangler.jsonc`.

## Como o isolamento entre empresas funciona

Na v1, o Postgres (RLS) filtrava os dados de cada empresa. O D1 não tem RLS, então são duas camadas:

1. **API** (`src/worker/acesso.ts`): toda rota de empresa (`/api/e/:slug/...`) confere a sessão, o papel e se o
   usuário pertence à empresa do endereço. Os serviços só consultam com o `empresaId` e o `perfilId` da sessão,
   nunca com valores vindos do navegador. A regra de quais vendas cada um vê fica num lugar só
   (`vendasVisiveis` em `src/worker/servicos/vendas.ts`).
2. **Banco** (`drizzle/migracoes/0001_gatilhos.sql`): gatilhos recusam venda, item ou produto de outra empresa,
   alteração ou exclusão de vendas e itens, cadastro acima do limite do plano, e recalculam o total da venda.

Os testes em `tests/` conferem as duas camadas (equivalem aos testes de RLS da v1).

## Rodando no computador

Pré-requisito: Node 24+. Não precisa de Docker: o D1 roda localmente pelo Wrangler.

```bash
npm install
cp .dev.vars.example .dev.vars    # preencha BETTER_AUTH_SECRET (o arquivo explica como gerar)
npm run db:reset                  # cria o banco local e aplica as migrações
npm run db:seed                   # dados de demonstração
npm run dev                       # http://localhost:5173
```

Endereços de demonstração: `/apiario-ribeiro`, `/mel-silva` e `/admin`.
Os usuários e a senha de teste estão em `src/worker/seed/demo.ts`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | App e API juntos (Vite + Worker local) |
| `npm run typecheck` | Checagem de tipos (telas, Worker, testes e scripts) |
| `npm test` | Testes da API e do banco: isolamento, permissões, vendas, login (Vitest no runtime do Workers) |
| `npm run test:e2e` | Testes de ponta a ponta no Chrome instalado (rode antes `npm run db:reset && npm run db:seed`) |
| `npm run db:gerar` | Gera uma migração nova a partir de `src/worker/db/esquema.ts` |
| `npm run db:reset` | Apaga o banco local e aplica as migrações |
| `npm run build` / `npm run deploy` | Gera os arquivos de produção / publica na Cloudflare |
| `npm run cf-typegen` | Atualiza os tipos do Worker depois de mudar o `wrangler.jsonc` |
| `npx tsx scripts/unificar-cidades.ts --remote` | Mostra cidades escritas de jeitos diferentes nos pontos ("Santa Vitoria" × "Santa Vitória"); com `--gravar`, unifica |

## Organização

```
src/app/             telas (React): paginas/, componentes/, api.ts (chamadas e redirecionamentos de acesso)
src/worker/          API (Hono): rotas/, servicos/, acesso.ts, auth/ (Better Auth), db/ (esquema Drizzle)
src/compartilhado/   o que as telas e a API usam juntos: tipos da API, esquemas Zod, formatos, regras de senha e slug
drizzle/migracoes/   esquema do banco e gatilhos (aplicados pelo Wrangler)
scripts/             seed local, apagar banco local, criar o admin da plataforma, unificar grafias de cidades
tests/               testes da API e do banco (Vitest)
e2e/                 testes de ponta a ponta (Playwright)
```

## Publicação na Cloudflare

**Situação atual:** publicado em https://ribeiro-nectar.gabriel-sistemas-00.workers.dev, com o banco D1
`banco-ribeiro-nectar` (migrações aplicadas), o segredo `BETTER_AUTH_SECRET` cadastrado e o mapa em modo
OpenStreetMap (`MAPA_PROVEDOR=osm`). Faltam o admin (passo 5), o Resend (passos 3 e 7) e o domínio (passo 6).
Ao ligar o domínio, troque `BETTER_AUTH_URL` no `wrangler.jsonc` e publique de novo.

Passo a passo para um ambiente novo:

1. **Banco**: `npx wrangler d1 create <nome>` e copie o nome e o `database_id` mostrados para o `wrangler.jsonc`.
2. **Migrações**: `npm run db:migrar-producao`.
3. **Segredos** (não vão para o git):
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put RESEND_API_KEY
   ```
   No `wrangler.jsonc`, confira `BETTER_AUTH_URL` (o endereço público do sistema), `MAPA_PROVEDOR` e `EMAIL_REMETENTE`.
4. **Publicar**: `npm run deploy`.
5. **Primeiro admin**: defina `ADMIN_NOME`, `ADMIN_EMAIL` e `ADMIN_SENHA` e rode `npx tsx scripts/criar-admin.ts --remote`.
6. **Domínio**: em *Workers e Pages → ribeiro-nectar → Configurações → Domínios*, adicione `www.ribeironectar.com.br`.
7. **Resend**: verifique o domínio (SPF/DKIM).
8. No painel `/admin`, cadastre o Apiário Ribeiro e o master inicial. O Lucas configura o Google Maps em
   *Configurações → Google Maps*.

### Atenção ao plano da Cloudflare

- **Senhas**: o hash das senhas usa PBKDF2 com 100 mil iterações (o máximo que o Workers aceita), que gasta
  dezenas de milissegundos de CPU por login. O plano grátis do Workers limita a CPU a 10 ms por requisição, então
  o login pode falhar nele. Para produção, use o **Workers Paid (US$ 5/mês)**. Teste o login logo depois de publicar.
- **D1 grátis**: 10 bancos e 5 GB por conta. Este sistema usa um banco só para todas as empresas.
- **Nominatim** (modo `osm`): o serviço público aceita 1 consulta por segundo e não é para uso comercial intenso.
  Para produção, use o Google Maps de cada empresa (`MAPA_PROVEDOR=google`).

## Qual mapa o sistema usa

A variável `MAPA_PROVEDOR` escolhe:

| Valor | Mapa | Quando usar |
|---|---|---|
| `google` (padrão) | Google Maps, com a chave de cada empresa | Uso final |
| `osm` | OpenStreetMap + Nominatim, sem chave nem cartão | Testes e desenvolvimento |

## Mapa e cidades: semáforo de visitas

O master define, no próprio mapa, os prazos de visita: até quantos dias desde a última venda o comércio
está **em dia** e até quantos está em **atenção**; depois disso fica **atrasado**. Cada pino ganha a cor da
situação, e um grupo de pinos fica com a cor do pior comércio dele. Enquanto o master não define os prazos,
os pinos ficam cor de mel. O revendedor vê as cores pelas vendas dele (a regra de sempre: só vê onde vendeu).

O botão **Estou aqui** usa o GPS do aparelho (vale para Google Maps e OpenStreetMap): mostra a posição
no mapa e abre a cidade do comércio mais próximo (até 25 km).

A cidade do ponto é digitada à mão; o sistema compara sem acento nem maiúsculas e grava a grafia que a
empresa já usa (`src/compartilhado/cidades.ts`).

## O que mudou em relação à v1

| v1 | v2 |
|---|---|
| Next.js (Server Components e Server Actions) | React + Vite no navegador, chamando a API Hono |
| Supabase Auth | Better Auth com sessões no D1 |
| Postgres com RLS e funções | D1 (SQLite) com Drizzle; regras na API e gatilhos no banco |
| Valores em `numeric` | Centavos e milésimos em inteiros (sem erro de arredondamento) |
| `/sair` (rota do servidor) | `POST /api/sessao/sair` |
| Rascunho da venda guardado pelo Next.js | Rascunho guardado na aba (`sessionStorage`) ao ir cadastrar um comércio |
