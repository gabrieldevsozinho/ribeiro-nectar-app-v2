type Email = { para: string; assunto: string; texto: string; html: string };

/**
 * Envia e-mail pelo Resend. Sem RESEND_API_KEY, em desenvolvimento, o conteúdo
 * vai para o terminal (para testar o fluxo sem conta de e-mail).
 */
export async function enviarEmail(env: Env, { para, assunto, texto, html }: Email): Promise<{ ok: boolean }> {
  const chave = env.RESEND_API_KEY;

  if (!chave) {
    if (env.AMBIENTE === "desenvolvimento") {
      console.info(`\n[e-mail de desenvolvimento] Para: ${para}\nAssunto: ${assunto}\n${texto}\n`);
      return { ok: true };
    }
    console.error("RESEND_API_KEY não configurada: e-mail não enviado.");
    return { ok: false };
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE || "Ribeiro Néctar <nao-responda@ribeironectar.com.br>",
      to: [para],
      subject: assunto,
      text: texto,
      html,
    }),
  });

  if (!resposta.ok) {
    console.error("Falha ao enviar e-mail pelo Resend:", resposta.status, await resposta.text());
    return { ok: false };
  }
  return { ok: true };
}

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
