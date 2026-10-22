import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

/** Mensagem de erro que a API devolve com status 422 (regra de negócio) para a tela mostrar. */
export class ErroDeNegocio extends Error {}

/** Junta a mensagem do erro com a das causas (o Drizzle embrulha o erro do D1). */
function textoDoErro(erro: unknown): string {
  const partes: string[] = [];
  let atual: unknown = erro;
  for (let i = 0; atual && i < 5; i++) {
    if (atual instanceof Error) partes.push(atual.message);
    else partes.push(String(atual));
    atual = (atual as { cause?: unknown }).cause;
  }
  return partes.join(" | ");
}

/** Traduz os erros conhecidos do banco (gatilhos e restrições) para o usuário. */
export function mensagemErroBanco(erro: unknown): string {
  const mensagem = typeof erro === "string" ? erro : textoDoErro(erro);
  if (mensagem.includes("LIMITE_PLANO")) return "Limite do seu plano atingido. Fale com a Gabriel Studio para ampliar.";
  if (mensagem.includes("ITEM_IMUTAVEL")) return "Itens de venda não podem ser alterados nem removidos.";
  if (mensagem.includes("VENDA_IMUTAVEL")) return "Vendas não podem ser alteradas nem apagadas.";
  if (mensagem.includes("PRODUTO_INATIVO")) return "Um dos produtos saiu do catálogo. Atualize a página e escolha de novo.";
  if (mensagem.includes("EMPRESA_INVALIDA")) return "Os dados informados não pertencem à sua empresa.";
  if (mensagem.includes("pontos_venda.cnpj") || mensagem.includes("pontos_cnpj_unico"))
    return "Já existe um ponto de venda com este CNPJ.";
  if (mensagem.includes("pontos_endereco_unico")) return "Já existe um ponto de venda neste endereço.";
  if (mensagem.includes("produtos_nome_unidade_unico")) return "Já existe um produto com este nome e unidade.";
  if (mensagem.includes("categorias_produto_nome_unico")) return "Já existe uma categoria com este nome.";
  if (mensagem.includes("empresas.slug")) return "Já existe uma empresa com este endereço.";
  if (mensagem.includes("perfis_email_unico") || mensagem.includes("auth_usuarios.email"))
    return "Já existe um usuário com este e-mail.";
  return "Não foi possível concluir. Tente de novo.";
}

/**
 * Valida o corpo (ou a busca) com Zod. Se o formato estiver errado, responde 422
 * com a primeira mensagem (em português: veja z.config no index do Worker).
 */
export function validar<T extends ZodType>(alvo: "json" | "query", esquema: T) {
  return zValidator(alvo, esquema, (resultado, c) => {
    if (!resultado.success) {
      const problema = resultado.error.issues[0];
      const campo = problema?.path.join(".");
      return c.json({ erro: problema ? `${campo ? `${campo}: ` : ""}${problema.message}` : "Dados inválidos." }, 422);
    }
  });
}
