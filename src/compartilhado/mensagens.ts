/** Motivos de saída mostrados na tela de login (?motivo=...). */
export const MOTIVOS_SAIDA: Record<string, { titulo: string; texto: string }> = {
  bloqueado: {
    titulo: "Seu acesso está bloqueado",
    texto: "Fale com o responsável da sua empresa para liberar o acesso.",
  },
  excluido: {
    titulo: "Este acesso foi removido",
    texto: "O cadastro deste usuário não existe mais.",
  },
  "empresa-inativa": {
    titulo: "Empresa desativada",
    texto: "O acesso desta empresa está suspenso. Fale com a Gabriel Studio.",
  },
  "outra-empresa": {
    titulo: "Este usuário não pertence a esta empresa",
    texto: "Confira o endereço da empresa ou entre com outro usuário.",
  },
  "sem-permissao": {
    titulo: "Sem permissão",
    texto: "Este usuário não tem acesso a esta área.",
  },
  saiu: {
    titulo: "Você saiu do sistema",
    texto: "Até a próxima!",
  },
};
