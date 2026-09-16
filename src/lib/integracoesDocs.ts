const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

function download(filename: string, content: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function baixarDocApi() {
  const md = `# API Pública — Lemon Caps

Base URL:
\`\`\`
${ENDPOINT}
\`\`\`

## Autenticação
Envie sua chave no header:
\`\`\`
x-api-key: SUA_CHAVE
\`\`\`
A chave é gerada em **Painel Administrador → API Keys** e exibida apenas uma vez no momento da criação.

## Permissões (escopos)
- \`pedidos\` — leitura de pedidos
- \`clientes\` — leitura de clientes

## Rotas

### GET /pedidos
Lista pedidos recentes.

**Exemplo:**
\`\`\`bash
curl -H "x-api-key: SUA_CHAVE" \\
  ${ENDPOINT}/pedidos
\`\`\`

### GET /pedidos/{id}
Retorna um pedido específico.

\`\`\`bash
curl -H "x-api-key: SUA_CHAVE" \\
  ${ENDPOINT}/pedidos/UUID_DO_PEDIDO
\`\`\`

### GET /clientes
Lista clientes. Aceita busca via querystring \`q\`.

\`\`\`bash
curl -H "x-api-key: SUA_CHAVE" \\
  "${ENDPOINT}/clientes?q=lemon"
\`\`\`

## Códigos de resposta
- \`200\` sucesso
- \`401\` chave ausente ou inválida
- \`403\` chave sem permissão para o recurso
- \`404\` recurso não encontrado
- \`429\` limite de requisições excedido
- \`500\` erro interno

## Boas práticas
- Nunca exponha a chave em código de frontend público.
- Rotacione a chave periodicamente (revogue e gere uma nova).
- Use o menor conjunto de permissões necessário.
`;
  download('api-publica-lemoncaps.md', md);
}

export function baixarDocWebhooks() {
  const md = `# Webhooks — Lemon Caps

Configurados em **Painel Administrador → Integrações**.

## Como funciona
Ao ocorrer um evento no sistema, o Lemon Caps faz um \`POST\` HTTP para cada URL cadastrada e ativa que estiver inscrita naquele evento.

## Headers enviados
\`\`\`
Content-Type: application/json
X-Webhook-Event: <nome.do.evento>
X-Webhook-Delivery: <uuid-da-entrega>
X-Webhook-Signature: sha256=<hmac_hex>   (apenas se um segredo foi configurado)
\`\`\`

## Verificando a assinatura (HMAC SHA-256)
O valor de \`X-Webhook-Signature\` é \`sha256=\` + HMAC do corpo bruto usando o segredo do webhook.

**Node.js:**
\`\`\`js
import crypto from 'node:crypto';

const signature = req.headers['x-webhook-signature'];
const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== expected) return res.status(401).end();
\`\`\`

## Eventos disponíveis

| Evento | Quando dispara |
|---|---|
| \`pedido.criado\` | Novo pedido é criado |
| \`pedido.atualizado\` | Qualquer atualização do pedido |
| \`pedido.concluido\` | Pedido marcado como concluído |
| \`contrato.enviado\` | Contrato interno enviado |
| \`contrato.assinado\` | Contrato assinado no ZapSign |

## Formato do payload

\`\`\`json
{
  "evento": "pedido.criado",
  "timestamp": "2026-07-10T12:34:56.000Z",
  "data": {
    // dados específicos do evento
  }
}
\`\`\`

### Exemplo — pedido.criado
\`\`\`json
{
  "evento": "pedido.criado",
  "timestamp": "2026-07-10T12:34:56.000Z",
  "data": {
    "id": "uuid",
    "numero": "PED-123",
    "cliente": { "nome": "Cliente X", "cnpj": "00.000.000/0001-00" },
    "total": 1234.56,
    "status": "pendente"
  }
}
\`\`\`

### Exemplo — contrato.assinado
\`\`\`json
{
  "evento": "contrato.assinado",
  "timestamp": "2026-07-10T12:34:56.000Z",
  "data": {
    "orcamento_id": "uuid",
    "signer_name": "Fulano",
    "signed_file_url": "https://..."
  }
}
\`\`\`

## Boas práticas
- Responda com **2xx em até 10s**; caso contrário, a entrega é marcada como falha.
- Torne o endpoint idempotente — use \`X-Webhook-Delivery\` para deduplicar.
- Valide a assinatura antes de processar em produção.
- Use HTTPS.
`;
  download('webhooks-lemoncaps.md', md);
}