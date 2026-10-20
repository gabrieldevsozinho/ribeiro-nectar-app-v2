/** Formato das chaves de API do Google ("AIza" + 35 caracteres). */
export const FORMATO_CHAVE = /^AIza[0-9A-Za-z_-]{35}$/;

export type ResultadoTesteMaps = { ok: true } | { ok: false; codigo: string; detalhe?: string };

/**
 * Traduz o resultado do teste (ou de uma falha durante o uso) para uma frase
 * que o master entenda, apontando o passo do guia que resolve.
 */
export function explicarResultadoMaps(resultado: ResultadoTesteMaps, origem = "https://www.ribeironectar.com.br"): string {
  if (resultado.ok) return "Chave válida. O mapa e a localização de endereços estão funcionando.";

  const detalhe = resultado.detalhe ?? "";
  if (/billing/i.test(detalhe)) return "O faturamento não está ativado no Google Cloud. Cadastre o cartão (passo 2).";

  switch (resultado.codigo) {
    case "ApiNotActivatedMapError":
      return "A Maps JavaScript API não está ativada no projeto do Google Cloud (passo 3).";
    case "BillingNotEnabledMapError":
      return "O faturamento não está ativado no Google Cloud. Cadastre o cartão (passo 2).";
    case "RefererNotAllowedMapError":
      return `Este endereço não está autorizado na chave. Adicione ${origem}/* nas restrições de sites (passo 5).`;
    case "InvalidKeyMapError":
    case "MissingKeyMapError":
      return "Chave inválida. Confira se você copiou a chave inteira.";
    case "ExpiredKeyMapError":
    case "DeletedApiProjectMapError":
    case "ProjectDeniedMapError":
      return "Esta chave expirou ou o projeto foi apagado no Google Cloud. Gere uma chave nova (passo 4).";
    case "ApiTargetBlockedMapError":
      return "A chave está restrita e não libera a Maps JavaScript API. Inclua as APIs na restrição (passo 5).";
    case "Geocoding_REQUEST_DENIED":
      return "A Geocoding API não está ativada ou não está liberada nesta chave (passos 3 e 5).";
    case "Geocoding_OVER_QUERY_LIMIT":
    case "Geocoding_OVER_DAILY_LIMIT":
      return "A cota do Google foi excedida. Confira o faturamento e os limites no Google Cloud.";
    case "SemConexao":
      return "Não foi possível falar com o Google. Confira a conexão com a internet e tente de novo.";
    case "TempoEsgotado":
      return "O Google não respondeu a tempo. Tente de novo em instantes.";
    default:
      return "O Google recusou a chave. Confira os passos 2, 3 e 5 do guia.";
  }
}

export function mascararChave(chave: string | null | undefined): string {
  if (!chave) return "";
  return `${chave.slice(0, 4)}…${chave.slice(-4)}`;
}
