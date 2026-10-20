/** Cookie com a última empresa acessada neste aparelho (abre o app instalado direto nela). */
export const COOKIE_ULTIMA_EMPRESA = "rn_empresa";

/** Mesmas regras da coluna empresas.slug no banco. */
export const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SLUGS_RESERVADOS = new Set(["admin", "api", "login", "sair", "static", "public", "assets", "favicon-ico", "icones"]);

/** "Apiário Ribeiro" → "apiario-ribeiro" */
export function normalizarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function slugValido(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_VALIDO.test(slug) && !SLUGS_RESERVADOS.has(slug);
}
