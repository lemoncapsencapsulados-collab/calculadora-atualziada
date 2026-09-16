// Envio direto por SMTP — usado hoje só pelo e-mail de contrato, que passou a
// sair pela caixa da Hostinger em vez do provedor padrão da fila.
//
// Por que SMTP e não uma API: a Hostinger não expõe API de e-mail
// transacional. A única porta de entrada é o próprio SMTP da caixa, com o
// mesmo usuário/senha usados no webmail.
//
// Duas regras da Hostinger moldam este módulo:
//   - O `From:` TEM de ser a caixa autenticada. Qualquer outro endereço é
//     recusado com "sender address rejected"; por isso o remetente é sempre
//     `SMTP_USER` e só o nome de exibição é configurável.
//   - A caixa é uma caixa comum, com cota por hora — não é infraestrutura de
//     disparo em massa. Serve para um contrato por vez, não para newsletter.

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export interface ConfigSmtp {
  hostname: string;
  port: number;
  usuario: string;
  senha: string;
  nomeRemetente: string;
  /**
   * `true` = TLS implícito, a conexão já nasce criptografada (porta 465, o
   * padrão da Hostinger). `false` = conexão limpa que sobe para TLS via
   * STARTTLS (porta 587). Escolher errado trava o handshake: o servidor fica
   * esperando um TLS que não vem, ou vice-versa.
   */
  tlsImplicito: boolean;
}

/** Quanto esperar por uma conexão SMTP antes de desistir e devolver a mensagem para a fila. */
const TIMEOUT_MS = 20_000;

/**
 * Lê a configuração SMTP dos secrets. Devolve `null` quando o SMTP não está
 * configurado — é assim que o despachante sabe que deve continuar usando o
 * provedor antigo, e é o que torna a migração reversível: basta apagar os
 * secrets para o envio voltar ao que era.
 */
export function lerConfigSmtp(): ConfigSmtp | null {
  const hostname = (Deno.env.get('SMTP_HOST') || '').trim();
  const usuario = (Deno.env.get('SMTP_USER') || '').trim();
  const senha = Deno.env.get('SMTP_PASSWORD') || '';

  if (!hostname || !usuario || !senha) return null;

  const portaBruta = Number(Deno.env.get('SMTP_PORT') || '465');
  const port = Number.isInteger(portaBruta) && portaBruta > 0 ? portaBruta : 465;

  // O modo de TLS segue a porta, que é o que acerta em 99% dos casos (465 =
  // implícito, 587 = STARTTLS). `SMTP_TLS` existe só para o servidor que foge
  // dessa convenção.
  const tlsExplicito = (Deno.env.get('SMTP_TLS') || '').trim().toLowerCase();
  const tlsImplicito =
    tlsExplicito === 'ssl' ? true : tlsExplicito === 'starttls' ? false : port !== 587;

  return {
    hostname,
    port,
    usuario,
    senha,
    nomeRemetente: (Deno.env.get('SMTP_FROM_NAME') || 'LemonCaps').trim() || 'LemonCaps',
    tlsImplicito,
  };
}

export interface MensagemSmtp {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envia uma mensagem e fecha a conexão. Lança em qualquer falha — o
 * despachante já trata exceção como "falhou, tenta de novo depois", então não
 * há nada a ganhar engolindo o erro aqui.
 */
export async function enviarPorSmtp(config: ConfigSmtp, mensagem: MensagemSmtp): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: config.hostname,
      port: config.port,
      tls: config.tlsImplicito,
      auth: { username: config.usuario, password: config.senha },
    },
  });

  // O denomailer não tem timeout próprio: numa porta filtrada o `send` fica
  // pendurado até o runtime matar a função inteira, e aí a mensagem nem volta
  // para a fila. O timeout transforma isso numa falha comum, que o
  // despachante sabe repetir.
  const relogio = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`SMTP: sem resposta de ${config.hostname}:${config.port} em ${TIMEOUT_MS / 1000}s`)),
      TIMEOUT_MS
    )
  );

  try {
    await Promise.race([
      client.send({
        from: `${config.nomeRemetente} <${config.usuario}>`,
        to: mensagem.to,
        subject: mensagem.subject,
        content: mensagem.text || 'auto',
        html: mensagem.html,
      }),
      relogio,
    ]);
  } finally {
    // Fechar nunca pode mascarar o erro real do envio.
    await client.close().catch(() => undefined);
  }
}
