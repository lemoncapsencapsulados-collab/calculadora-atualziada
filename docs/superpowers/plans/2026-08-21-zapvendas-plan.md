# Plano de implementação — ZapVendas

Caixa de entrada unificada de WhatsApp dos vendedores, via Evolution API já
hospedada na VPS do cliente.

## Contexto

- Projeto: Vite + React 18 + TypeScript + Tailwind + shadcn/ui, Supabase.
- Cliente Supabase: `@/integrations/supabase/client` (exporta `supabase`).
- Evolution API **v2.3.7** em `https://evo.lemoncapsauto.com` (Baileys).
  `DATABASE_ENABLED=true` — ela guarda chats e mensagens no banco dela, e o
  histórico **persiste mesmo com a instância desconectada**. Por isso não
  espelhamos mensagens no Supabase.
- Secrets já configuradas no Supabase: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`.
- Auth: existe **um login compartilhado** pela equipe. Foi criado um segundo
  usuário admin `joaoferrari@gmail.com` (auth id `616bec17-a29b-4ec7-b4a1-417ea00da66f`).
  O login original é `comercial@lemoncaps.com.br` (auth id `3d18bee7-fdc4-4adc-b8c1-42175d68052f`).
- `public.usuarios` é **tabela de diretório**, NÃO ligada a `auth.users`.
  Colunas: `id uuid`, `nome text`, `cargo text`, `email text`, `telefone text`,
  `ativo boolean`, `created_at`, `updated_at`.

## Global Constraints

1. **A `EVOLUTION_API_KEY` nunca pode chegar ao browser.** Todo acesso à
   Evolution passa pela edge function. Nenhum `fetch` direto do front para
   `evo.lemoncapsauto.com`.
2. **Não quebrar nada existente.** Nenhuma alteração em página, componente,
   hook ou tabela que já exista, exceto os pontos de integração nomeados na
   Tarefa 5 (rota + item de menu).
3. **Sem tempo real.** Nenhum webhook, nenhuma tabela espelho de mensagens,
   nenhuma subscription. Os dados são buscados sob demanda.
4. **Envio apenas de texto.** Mídia recebida deve ser exibida (ou indicada),
   mas não há upload nesta rodada.
5. **Design system.** Usar os tokens existentes (`primary`, `muted`,
   `success`, `destructive`, `border`, `citrus`) e as classes utilitárias
   `.num` (números/datas em mono tabular) e `.eyebrow` (rótulo de seção).
   Nunca usar cores cravadas (`green-500`, `blue-600`, etc).
6. **Português do Brasil** em toda a interface e nos comentários de código.
7. `npm run build` precisa passar ao fim de cada tarefa.

---

## Tarefa 1 — Migration: papéis e instâncias

Criar `supabase/migrations/20260821120000_zapvendas.sql`.

**`public.user_roles`** — o sistema não tem papéis hoje; este é o mínimo.
```sql
create type public.app_role as enum ('admin', 'zapvendas');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
```

**Helper SECURITY DEFINER** (obrigatório: uma policy não pode consultar
`user_roles` diretamente sem recursão de RLS):
```sql
create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = _role
) $$;
```

**`public.zap_instancias`** — liga instância da Evolution a um vendedor.
```sql
create table public.zap_instancias (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null unique,
  usuario_id uuid references public.usuarios(id) on delete set null,
  numero text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**RLS**: ligar em ambas. Em `zap_instancias`, todas as operações exigem
`public.has_role('zapvendas')`. Em `user_roles`, SELECT permitido apenas ao
próprio usuário (`user_id = auth.uid()`); nenhuma policy de INSERT/UPDATE/
DELETE (gerenciado via service_role).

**Seed**: inserir `('3d18bee7-fdc4-4adc-b8c1-42175d68052f','zapvendas')` e
`('616bec17-a29b-4ec7-b4a1-417ea00da66f','zapvendas')` e o mesmo par com
`'admin'`, com `on conflict do nothing`.

**Trigger** de `updated_at` em `zap_instancias` (seguir o padrão já usado
nas migrations existentes do projeto — verificar como as outras fazem).

Entregável: só o arquivo `.sql`. Não executar nada.

---

## Tarefa 2 — Edge function `zapvendas`

Criar `supabase/functions/zapvendas/index.ts`. Seguir o estilo das funções
existentes (ver `supabase/functions/public-api/index.ts` para CORS e formato
de resposta).

**Config**: adicionar em `supabase/config.toml`:
```toml
  [functions.zapvendas]
    verify_jwt = true
```

**Segurança** — a cada requisição, nesta ordem:
1. Tratar `OPTIONS` (CORS).
2. Ler o JWT do header `Authorization`, resolver o usuário com o client
   Supabase (anon key + header do usuário). Sem usuário → 401.
3. Confirmar papel: consultar `user_roles` com o **service_role** para
   `user_id = <usuário> and role = 'zapvendas'`. Sem papel → 403.
4. Só então falar com a Evolution.

**Contrato**: `POST` com `{ action: string, ...params }`. Responder sempre
`{ ok: boolean, data?: unknown, error?: string }` com `Content-Type: application/json`.

Ações (chamadas na Evolution, header `apikey: EVOLUTION_API_KEY`):

| action | Evolution | params |
|---|---|---|
| `instances.list` | `GET /instance/fetchInstances` | — |
| `instances.create` | `POST /instance/create` body `{instanceName, integration:"WHATSAPP-BAILEYS", qrcode:true}` | `instanceName` |
| `instances.qrcode` | `GET /instance/connect/{instanceName}` | `instanceName` |
| `instances.state` | `GET /instance/connectionState/{instanceName}` | `instanceName` |
| `instances.logout` | `DELETE /instance/logout/{instanceName}` | `instanceName` |
| `instances.delete` | `DELETE /instance/delete/{instanceName}` | `instanceName` |
| `chats.list` | `POST /chat/findChats/{instanceName}` body `{}` | `instanceName` |
| `messages.list` | `POST /chat/findMessages/{instanceName}` body `{where:{key:{remoteJid}},limit}` | `instanceName`, `remoteJid`, `limit` (padrão 50) |
| `messages.send` | `POST /message/sendText/{instanceName}` body `{number, text}` | `instanceName`, `number`, `text` |

Validar `action` contra uma lista fechada — nunca montar a URL da Evolution a
partir de entrada livre do usuário. Erro da Evolution → repassar status e
mensagem em `{ok:false,error}`, sem vazar a apikey.

---

## Tarefa 3 — Camada de dados no front

Criar `src/types/zapvendas.ts` e `src/hooks/useZapVendas.ts`.

**Tipos** (derivados do retorno real da Evolution):
```ts
export interface ZapInstancia { id: string; instance_name: string; usuario_id: string | null; numero: string | null; ativo: boolean; }
export interface ZapInstanciaEvolution { name: string; connectionStatus: 'open'|'close'|'connecting'; ownerJid?: string; profileName?: string; profilePicUrl?: string; number?: string; }
export interface ZapChat { id: string; remoteJid: string; pushName?: string; profilePicUrl?: string; updatedAt?: string; lastMessage?: { key?: { fromMe?: boolean }; message?: unknown; messageTimestamp?: number }; }
export interface ZapMensagem { id: string; key: { id: string; fromMe: boolean; remoteJid: string }; message?: Record<string, unknown>; messageTimestamp: number; pushName?: string; messageType?: string; }
```

**Hook** — usar `@tanstack/react-query` (já é o padrão do projeto; ver
`src/hooks/useOrcamentos.ts`). Um helper `invokeZap(action, params)` que
chama `supabase.functions.invoke('zapvendas', { body: { action, ...params } })`
e desembrulha `{ok,data,error}`, lançando `Error(error)` quando `ok=false`.

Expor: `useZapInstancias()` (junta `zap_instancias` do Supabase com o estado
vindo de `instances.list`), `useZapChats(instanceName)`,
`useZapMensagens(instanceName, remoteJid)`, `useEnviarMensagem()`,
`useCriarInstancia()`, `useQrCode(instanceName)`.

**Helpers de mensagem** (a Evolution devolve formatos variados):
- `extrairTexto(m: ZapMensagem): string` — cobrir `conversation`,
  `extendedTextMessage.text`, `imageMessage.caption`, `videoMessage.caption`.
- `tipoMidia(m): 'imagem'|'audio'|'video'|'documento'|'texto'` — para exibir
  "🎤 Áudio" quando não houver texto.
- `normalizarTelefone(v: string): string` — só dígitos, remove `55` inicial
  quando o resto tiver 10 ou 11 dígitos. Usado para casar com `clientes.telefone`.
- `jidParaTelefone(jid: string): string` — parte antes de `@`.

Grupos (`@g.us`) devem ser identificáveis: `ehGrupo(remoteJid)`.

---

## Tarefa 4 — Tela `/zapvendas`

Criar `src/pages/ZapVendas.tsx` e os componentes em `src/components/zapvendas/`.

Layout de três painéis, altura cheia abaixo da navbar (`h-[calc(100vh-3.5rem)]`):

- **Esquerda (`w-72`, `PainelInstancias.tsx`)** — vendedores e conexão.
  Cada instância: avatar, nome do vendedor (de `usuarios` via `usuario_id`,
  caindo para `instance_name`), ponto de status (aberto = `success`,
  conectando = `warning`, fechado = `muted-foreground`), número em `.num`.
  Botão "Conectar WhatsApp" abre `DialogQrCode.tsx` com o QR (base64 da
  Evolution), re-buscando o estado a cada 5s até `open`, então fecha sozinho.
  Botão para criar instância nova, escolhendo o vendedor de `usuarios` (`ativo=true`).
  Filtro "Todos os vendedores" no topo, que controla o painel do centro.

- **Centro (`w-96`, `ListaConversas.tsx`)** — conversas de **todas** as
  instâncias, unificadas e ordenadas por `updatedAt` desc. Cada linha: avatar,
  nome (`pushName` ou telefone), prévia da última mensagem, hora em `.num`,
  e um selo com o vendedor dono. Campo de busca por nome/telefone.
  Estado vazio com instrução clara ("Conecte o WhatsApp de um vendedor para
  ver as conversas"), nunca uma tela em branco.

- **Direita (`flex-1`, `JanelaConversa.tsx`)** — cabeçalho com contato,
  balões (`fromMe` à direita com `bg-primary text-primary-foreground`, os
  outros à esquerda com `bg-muted`), hora em `.num`, rolagem automática para
  o fim. Composer com `Textarea`: Enter envia, Shift+Enter quebra linha,
  desabilitado se a instância não estiver `open` (com o motivo visível).
  Botão de atualizar (não há tempo real — deixe isso óbvio na interface).

**Não usar `alert()`** — usar o `toast` do projeto (`@/hooks/use-toast`).
Estados de carregamento com `Skeleton`; erros com mensagem acionável.

---

## Tarefa 5 — Rota, menu e proteção de acesso

1. `src/hooks/useTemPapel.ts` — consulta `user_roles` do usuário logado e
   devolve `{ temPapel: boolean, carregando: boolean }`.
2. `src/App.tsx` — adicionar a rota `/zapvendas` junto das existentes,
   seguindo exatamente o padrão das outras rotas protegidas.
3. `src/components/Navigation.tsx` — acrescentar ao grupo **Operação** o item
   `{ to: '/zapvendas', label: 'ZapVendas', short: 'ZapVendas', icon: MessageCircle }`,
   **renderizado apenas quando `useTemPapel('zapvendas')` for verdadeiro**.
   Incluir também na paleta de comandos sob a mesma condição.
4. A página em si revalida o papel: sem permissão, mostra um aviso claro em
   vez do conteúdo (defesa em profundidade — o RLS e a edge function já barram).

---

## Verificação final

- `npm run build` passa.
- Nenhuma referência a `EVOLUTION_API_KEY` fora de `supabase/functions/`.
- Nenhuma rota/página/componente existente alterada além de `App.tsx` e
  `Navigation.tsx`.
