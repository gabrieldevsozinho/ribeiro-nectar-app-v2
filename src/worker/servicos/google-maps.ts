import { and, eq } from "drizzle-orm";
import { FORMATO_CHAVE, explicarResultadoMaps, type ResultadoTesteMaps } from "@/compartilhado/google-maps-erros";
import type { ConfigGoogleMaps, ConfigMapaCliente, StatusGoogleMaps } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { googleMapsEmpresa } from "../db/esquema";
import { ErroDeNegocio } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

/**
 * Qual mapa o sistema usa. "osm" (OpenStreetMap + Nominatim) não precisa de chave nem de
 * cartão: serve para testar. "google" usa a chave de cada empresa (padrão, uso final).
 */
export function provedorMapa(env: Env): "google" | "osm" {
  return env.MAPA_PROVEDOR === "osm" ? "osm" : "google";
}

async function lerConfig(db: Db, empresaId: string) {
  return db
    .select({
      chave: googleMapsEmpresa.chave,
      status: googleMapsEmpresa.status,
      ultimoErro: googleMapsEmpresa.ultimoErro,
      validadaEm: googleMapsEmpresa.validadaEm,
    })
    .from(googleMapsEmpresa)
    .where(eq(googleMapsEmpresa.empresaId, empresaId))
    .get();
}

/**
 * Configuração do mapa que vai para o navegador. A chave é sempre a da empresa de quem
 * está logado (o empresaId vem da sessão). Em produção não existe chave de reserva:
 * sem a chave da empresa, o mapa fica desligado.
 */
export async function configMapaCliente(env: Env, db: Db, u: UsuarioDaEmpresa): Promise<ConfigMapaCliente> {
  const ehMaster = u.papel === "master";
  const slug = u.empresa.slug;
  if (provedorMapa(env) === "osm") return { slug, provedor: "osm", chave: null, origem: null, ehMaster, disponivel: true };

  const config = await lerConfig(db, u.empresa.id);
  const status: StatusGoogleMaps = config?.status ?? "nao_configurada";
  if (config?.chave && status === "valida") {
    return { slug, provedor: "google", chave: config.chave, origem: "empresa", ehMaster, disponivel: true };
  }
  if (env.AMBIENTE === "desenvolvimento" && env.GOOGLE_MAPS_CHAVE_DEV && status === "nao_configurada") {
    return { slug, provedor: "google", chave: env.GOOGLE_MAPS_CHAVE_DEV, origem: "dev", ehMaster, disponivel: true };
  }
  return { slug, provedor: "google", chave: null, origem: null, ehMaster, disponivel: false };
}

/** Tela de configuração (só o master). */
export async function obterConfigGoogleMaps(env: Env, db: Db, u: UsuarioDaEmpresa): Promise<ConfigGoogleMaps> {
  const config = await lerConfig(db, u.empresa.id);
  return {
    provedor: provedorMapa(env),
    chave: config?.chave ?? null,
    status: config?.status ?? "nao_configurada",
    ultimoErro: config?.ultimoErro ?? null,
    validadaEm: config?.validadaEm ?? null,
  };
}

/** Status para a faixa de aviso no topo (só o master, e só quando o mapa é o Google). */
export async function statusParaAviso(env: Env, db: Db, u: UsuarioDaEmpresa): Promise<StatusGoogleMaps | null> {
  if (u.papel !== "master" || provedorMapa(env) === "osm") return null;
  const config = await lerConfig(db, u.empresa.id);
  return !config || config.status === "valida" ? null : config.status;
}

/**
 * Salva a chave junto com o resultado do teste feito no navegador.
 * Uma chave que falhou também é guardada (como "com erro"): assim o master
 * corrige no Google Cloud e testa de novo sem colar a chave outra vez.
 */
export async function salvarChaveMaps(
  db: Db,
  u: UsuarioDaEmpresa,
  dados: { chave: string; resultado: ResultadoTesteMaps; origem: string },
): Promise<{ ok: boolean; mensagem: string }> {
  const chave = dados.chave.trim();
  if (!FORMATO_CHAVE.test(chave)) {
    throw new ErroDeNegocio("Isso não parece uma chave do Google Maps. Ela começa com “AIza” e tem 39 caracteres.");
  }

  const mensagem = explicarResultadoMaps(dados.resultado, dados.origem);
  const agora = new Date().toISOString();
  await db
    .update(googleMapsEmpresa)
    .set({
      chave,
      status: dados.resultado.ok ? "valida" : "com_erro",
      ultimoErro: dados.resultado.ok ? null : mensagem,
      validadaEm: dados.resultado.ok ? agora : null,
      atualizadaPor: u.perfilId,
      atualizadaEm: agora,
    })
    .where(eq(googleMapsEmpresa.empresaId, u.empresa.id));
  return { ok: dados.resultado.ok, mensagem };
}

export async function removerChaveMaps(db: Db, u: UsuarioDaEmpresa) {
  await db
    .update(googleMapsEmpresa)
    .set({
      chave: null,
      status: "nao_configurada",
      ultimoErro: null,
      validadaEm: null,
      atualizadaPor: u.perfilId,
      atualizadaEm: new Date().toISOString(),
    })
    .where(eq(googleMapsEmpresa.empresaId, u.empresa.id));
  return "Chave removida. O mapa ficou desligado.";
}

/**
 * Chamado pelo navegador de qualquer usuário da empresa quando o Google recusa
 * a chave durante o uso (cartão vencido, API desativada…). Só marca erro se a
 * chave estava válida; os masters passam a ver o aviso no topo do sistema.
 */
export async function reportarFalhaMaps(db: Db, u: UsuarioDaEmpresa, resultado: ResultadoTesteMaps) {
  if (resultado.ok) return;
  await db
    .update(googleMapsEmpresa)
    .set({ status: "com_erro", ultimoErro: explicarResultadoMaps(resultado).slice(0, 300), atualizadaEm: new Date().toISOString() })
    .where(and(eq(googleMapsEmpresa.empresaId, u.empresa.id), eq(googleMapsEmpresa.status, "valida")));
}
