# Funis de Tráfego Pago — Fase C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coletar a Meta em nível de anúncio e criativo e publicar `/funis-trafego-pago` com visão geral, hierarquia campanha→conjunto→anúncio e criativos com a copy que estava no ar.

**Architecture:** Fila de jobs com checkpoint (espelha `zap_backfill_jobs`) alimenta quatro tabelas novas; a base é somável e os recortes ficam em formato longo com discriminador para impedir dupla contagem. Métrica agregada em SQL por RPC; o front só desenha. A integração com a Meta que já existe é estendida por um módulo `_shared/meta.ts`, não duplicada.

**Tech Stack:** Supabase (Postgres + Edge Functions em Deno), React + Vite + TypeScript, TanStack Query, Tailwind, vitest (novo).

**Spec:** `docs/superpowers/specs/2026-09-01-funis-trafego-pago-design.md`

## Global Constraints

- RLS sempre como `using ((select has_role('trafego'::app_role)))` — subconsulta escalar, nunca função nua. Função nua custou 63,8s contra 0,653s em `zap_mensagens`.
- Testar desempenho sob o papel `authenticated`, nunca `service_role` — service_role ignora RLS e mede o caminho errado.
- Nenhuma consulta acima de 1s.
- `ALTER TYPE ... ADD VALUE` não roda dentro da transação da migração: migração isolada, sozinha.
- Retenção: `meta_insights_ad` 180 dias, `meta_insights_ad_recorte` 90 dias. O backfill segue a retenção de cada passe.
- Módulos em `supabase/functions/_shared/` recebem configuração por parâmetro. Nada de `Deno.env` dentro deles — é o que os torna testáveis por vitest.
- Comentários em português, explicando o porquê e não o quê, como no resto do projeto.
- Só a conta `C.A – Lemon Caps` entra na coleta, via `meta_ad_accounts.coletar_nivel_ad`.
- Números nunca sem base declarada. O que não é medido aparece bloqueado, nunca aproximado.

---

### Task 1: Infraestrutura de teste

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: script `npm test`, capaz de rodar `*.test.ts` em `supabase/functions/_shared/`.

- [ ] **Step 1: Instalar vitest**

```bash
npm install -D vitest@^2
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os módulos _shared são TypeScript puro, sem API do Deno — por isso rodam
    // aqui. Manter assim é o que permite testá-los sem subir uma edge function.
    include: ['supabase/functions/_shared/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Adicionar o script**

Em `package.json`, dentro de `scripts`: `"test": "vitest run"`.

- [ ] **Step 4: Verificar**

Run: `npm test`
Expected: passa sem nenhum teste encontrado (exit 0), ou "No test files found" — o importante é o runner subir.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Vitest para a logica pura da coleta de anuncios"
```

---

### Task 2: Papel `trafego`

**Files:**
- Create: `supabase/migrations/20260901310000_papel_trafego.sql`

**Interfaces:**
- Produces: valor `'trafego'` no enum `public.app_role`, consumido por toda política RLS da Task 3.

- [ ] **Step 1: Escrever a migração, sozinha no arquivo**

```sql
-- `ALTER TYPE ... ADD VALUE` não roda dentro de bloco transacional. Como o
-- Supabase envolve cada migração numa transação, este comando precisa estar
-- sozinho no arquivo — junto de qualquer outro DDL, a migração falha ao aplicar.
alter type public.app_role add value if not exists 'trafego';
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db push`
Depois, no SQL editor: `select unnest(enum_range(null::public.app_role));`
Expected: `admin`, `zapvendas`, `trafego`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260901310000_papel_trafego.sql
git commit -m "Papel trafego no enum app_role"
```

---

### Task 3: Tabelas, RLS e índices

**Files:**
- Create: `supabase/migrations/20260901320000_trafego_tabelas.sql`

**Interfaces:**
- Consumes: papel `trafego` (Task 2).
- Produces: `meta_insights_ad`, `meta_insights_ad_recorte`, `meta_criativos`, `meta_sync_jobs`, coluna `meta_ad_accounts.coletar_nivel_ad`.

- [ ] **Step 1: Escrever a migração**

Conteúdo integral em `docs/superpowers/specs/2026-09-01-funis-trafego-pago-design.md` §3. Pontos que não podem ser esquecidos:

```sql
-- A base é a ÚNICA tabela somável. Recorte mora separado de propósito: a Meta
-- devolve breakdowns como recortes independentes do MESMO gasto, e somar uma
-- linha de plataforma com uma de idade dobra o investimento sem avisar.
create table if not exists public.meta_insights_ad (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  data date not null,
  campaign_id text, campaign_name text,
  adset_id text, adset_name text,
  ad_name text,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric not null default 0,
  actions jsonb, action_values jsonb, cost_per_action_type jsonb,
  leads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, ad_id, data)
);

create table if not exists public.meta_insights_ad_recorte (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  data date not null,
  recorte text not null check (recorte in ('plataforma_posicionamento','idade_genero')),
  chave_1 text not null default '',
  chave_2 text not null default '',
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  actions jsonb,
  created_at timestamptz not null default now(),
  unique (ad_account_id, ad_id, data, recorte, chave_1, chave_2)
);

create table if not exists public.meta_criativos (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  ad_name text,
  titulo text, corpo text, descricao text, cta text, url_destino text,
  image_url text, video_id text,
  object_story_spec jsonb,
  hash_conteudo text not null,
  vigente_desde date not null,
  vigente_ate date,               -- null = no ar
  created_at timestamptz not null default now(),
  unique (ad_id, hash_conteudo)
);

create table if not exists public.meta_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  passe text not null check (passe in ('base','criativo','plataforma','demografia')),
  janela_inicio date not null,
  janela_fim date not null,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','dlq')),
  tentativas integer not null default 0,
  ultimo_erro text,
  cursor_paginacao text,
  linhas_gravadas integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (ad_account_id, passe, janela_inicio, janela_fim)
);

alter table public.meta_ad_accounts
  add column if not exists coletar_nivel_ad boolean not null default false;
```

Índices que sustentam o teto de 1s:

```sql
create index if not exists idx_insights_ad_conta_data
  on public.meta_insights_ad (ad_account_id, data desc);
create index if not exists idx_insights_ad_campanha
  on public.meta_insights_ad (campaign_id, data desc);
create index if not exists idx_recorte_conta_data_recorte
  on public.meta_insights_ad_recorte (ad_account_id, recorte, data desc);
create index if not exists idx_criativo_vigente
  on public.meta_criativos (ad_id, vigente_desde desc);
create index if not exists idx_sync_jobs_pendente
  on public.meta_sync_jobs (status, passe, atualizado_em)
  where status in ('pending','failed');
```

RLS — leitura pelo papel `trafego`, escrita só pela service_role (quem escreve é a coleta):

```sql
alter table public.meta_insights_ad         enable row level security;
alter table public.meta_insights_ad_recorte enable row level security;
alter table public.meta_criativos           enable row level security;
alter table public.meta_sync_jobs           enable row level security;

-- Subconsulta escalar, não função nua: vira InitPlan e o Postgres resolve uma
-- vez por consulta em vez de uma vez por linha.
create policy "trafego le insights_ad" on public.meta_insights_ad
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le recorte" on public.meta_insights_ad_recorte
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le criativos" on public.meta_criativos
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le jobs" on public.meta_sync_jobs
  for select to authenticated using ((select has_role('trafego'::app_role)));

grant select on public.meta_insights_ad, public.meta_insights_ad_recorte,
                public.meta_criativos, public.meta_sync_jobs to authenticated;
grant all    on public.meta_insights_ad, public.meta_insights_ad_recorte,
                public.meta_criativos, public.meta_sync_jobs to service_role;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db push`
Expected: aplica sem erro.

- [ ] **Step 3: Verificar que o RLS realmente barra**

No SQL editor, com uma sessão `authenticated` sem o papel: `select count(*) from meta_insights_ad;`
Expected: `0` (não erro) — é como o RLS de leitura se comporta.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260901320000_trafego_tabelas.sql
git commit -m "Tabelas de trafego pago com RLS por papel"
```

---

### Task 4: `_shared/metaGraph.ts` — cliente da Graph com backoff

**Files:**
- Create: `supabase/functions/_shared/metaGraph.ts`
- Test: `supabase/functions/_shared/metaGraph.test.ts`

**Interfaces:**
- Produces:
  - `interface ConsumoConta { chamadas: number; cpuTotal: number; }`
  - `function lerConsumo(headers: Headers, adAccountId: string): ConsumoConta | null`
  - `function deveEsperar(c: ConsumoConta | null, limite?: number): boolean`
  - `function atrasoBackoff(tentativa: number): number`

- [ ] **Step 1: Escrever os testes primeiro**

```ts
import { describe, it, expect } from 'vitest';
import { lerConsumo, deveEsperar, atrasoBackoff } from './metaGraph.ts';

describe('lerConsumo', () => {
  it('lê o percentual da conta no cabeçalho de uso', () => {
    const h = new Headers({
      'x-business-use-case-usage':
        JSON.stringify({ '123': [{ call_count: 42, total_cputime: 7, total_time: 9 }] }),
    });
    expect(lerConsumo(h, 'act_123')).toEqual({ chamadas: 42, cpuTotal: 7 });
  });

  it('devolve null quando o cabeçalho não existe', () => {
    expect(lerConsumo(new Headers(), 'act_123')).toBeNull();
  });

  it('devolve null quando o cabeçalho é ilegível', () => {
    const h = new Headers({ 'x-business-use-case-usage': 'nao-e-json' });
    expect(lerConsumo(h, 'act_123')).toBeNull();
  });
});

describe('deveEsperar', () => {
  it('manda esperar acima do limite', () => {
    expect(deveEsperar({ chamadas: 85, cpuTotal: 10 }, 80)).toBe(true);
  });
  it('deixa passar abaixo do limite', () => {
    expect(deveEsperar({ chamadas: 40, cpuTotal: 10 }, 80)).toBe(false);
  });
  it('sem leitura de consumo, deixa passar — não inventa bloqueio', () => {
    expect(deveEsperar(null, 80)).toBe(false);
  });
});

describe('atrasoBackoff', () => {
  it('cresce a cada tentativa', () => {
    expect(atrasoBackoff(2)).toBeGreaterThan(atrasoBackoff(1));
  });
  it('tem teto, para não dormir minutos', () => {
    expect(atrasoBackoff(20)).toBeLessThanOrEqual(30_000);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o mínimo**

O `ad_account_id` chega como `act_123`; a chave do cabeçalho é só o número. Nenhuma leitura de `Deno.env` aqui — configuração entra por parâmetro, e é isso que mantém o módulo testável.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/metaGraph.ts supabase/functions/_shared/metaGraph.test.ts
git commit -m "Cliente da Graph com leitura de consumo e backoff"
```

---

### Task 5: `_shared/metaMapear.ts` — insights crus viram linha de tabela

**Files:**
- Create: `supabase/functions/_shared/metaMapear.ts`
- Test: `supabase/functions/_shared/metaMapear.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `function extrairLeads(actions: unknown): number`
  - `function paraLinhaBase(l: any, adAccountId: string): LinhaBase`
  - `function paraLinhaRecorte(l: any, adAccountId: string, recorte: 'plataforma_posicionamento' | 'idade_genero'): LinhaRecorte`

- [ ] **Step 1: Escrever os testes primeiro**

```ts
import { describe, it, expect } from 'vitest';
import { extrairLeads, paraLinhaBase, paraLinhaRecorte } from './metaMapear.ts';

describe('extrairLeads', () => {
  it('soma os tipos que contam como lead', () => {
    expect(extrairLeads([
      { action_type: 'lead', value: '3' },
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' },
      { action_type: 'link_click', value: '99' },
    ])).toBe(5);
  });
  it('tolera entrada que não é lista', () => {
    expect(extrairLeads(null)).toBe(0);
  });
});

describe('paraLinhaBase', () => {
  const cru = {
    date_start: '2026-08-12', ad_id: '777', ad_name: 'Anuncio A',
    adset_id: '55', adset_name: 'Conjunto', campaign_id: '9', campaign_name: 'Campanha',
    spend: '10.50', impressions: '1000', clicks: '30', reach: '900', frequency: '1.11',
    actions: [{ action_type: 'lead', value: '4' }],
  };

  it('converte número que vem como string', () => {
    const r = paraLinhaBase(cru, 'act_1');
    expect(r.spend).toBe(10.5);
    expect(r.impressions).toBe(1000);
  });

  it('preserva actions cru — foi descartá-lo que cegou a meta_insights antiga', () => {
    expect(paraLinhaBase(cru, 'act_1').actions).toEqual(cru.actions);
  });

  it('deriva leads sem perder a evidência', () => {
    expect(paraLinhaBase(cru, 'act_1').leads).toBe(4);
  });
});

describe('paraLinhaRecorte', () => {
  it('põe plataforma e posicionamento nas chaves, na ordem', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2',
        publisher_platform: 'facebook', platform_position: 'feed' },
      'act_1', 'plataforma_posicionamento');
    expect([r.chave_1, r.chave_2]).toEqual(['facebook', 'feed']);
  });

  it('põe idade e gênero nas chaves, na ordem', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2', age: '25-34', gender: 'female' },
      'act_1', 'idade_genero');
    expect([r.chave_1, r.chave_2]).toEqual(['25-34', 'female']);
  });

  it('usa string vazia no lugar de nulo — a chave única não aceita null', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2', age: '25-34' },
      'act_1', 'idade_genero');
    expect(r.chave_2).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/metaMapear.ts supabase/functions/_shared/metaMapear.test.ts
git commit -m "Mapeamento de insights de anuncio e de recorte"
```

---

### Task 6: `_shared/metaCriativo.ts` — hash e versionamento

**Files:**
- Create: `supabase/functions/_shared/metaCriativo.ts`
- Test: `supabase/functions/_shared/metaCriativo.test.ts`

**Interfaces:**
- Produces:
  - `function extrairCriativo(ad: any): CriativoExtraido`
  - `async function hashCriativo(c: CriativoExtraido): Promise<string>`
  - `function decidirVersao(atual: {hash_conteudo: string} | null, novo: string, hoje: string): 'manter' | 'abrir'`

- [ ] **Step 1: Escrever os testes primeiro**

```ts
import { describe, it, expect } from 'vitest';
import { extrairCriativo, hashCriativo, decidirVersao } from './metaCriativo.ts';

const adBase = {
  id: '777', name: 'Anuncio A',
  creative: {
    body: 'Emagreça com saúde', title: 'Fórmula manipulada',
    object_story_spec: { link_data: { message: 'Emagreça com saúde', link: 'https://lp.com' } },
  },
};

describe('hashCriativo', () => {
  it('mesmo conteúdo, mesmo hash', async () => {
    const a = await hashCriativo(extrairCriativo(adBase));
    const b = await hashCriativo(extrairCriativo({ ...adBase }));
    expect(a).toBe(b);
  });

  it('copy diferente, hash diferente — é o que detecta troca de criativo', async () => {
    const outro = { ...adBase, creative: { ...adBase.creative, body: 'Outro texto' } };
    expect(await hashCriativo(extrairCriativo(adBase)))
      .not.toBe(await hashCriativo(extrairCriativo(outro)));
  });

  it('nome do anúncio não entra no hash: renomear não é trocar o criativo', async () => {
    const renomeado = { ...adBase, name: 'Anuncio A — v2' };
    expect(await hashCriativo(extrairCriativo(adBase)))
      .toBe(await hashCriativo(extrairCriativo(renomeado)));
  });
});

describe('decidirVersao', () => {
  it('abre versão quando não há nenhuma', () => {
    expect(decidirVersao(null, 'abc', '2026-09-01')).toBe('abrir');
  });
  it('mantém quando o hash é o mesmo', () => {
    expect(decidirVersao({ hash_conteudo: 'abc' }, 'abc', '2026-09-01')).toBe('manter');
  });
  it('abre quando o hash mudou', () => {
    expect(decidirVersao({ hash_conteudo: 'abc' }, 'xyz', '2026-09-01')).toBe('abrir');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — Run: `npm test`

- [ ] **Step 3: Implementar** — hash com `crypto.subtle.digest('SHA-256', ...)`, disponível tanto no Deno quanto no Node 18+.

- [ ] **Step 4: Rodar e ver passar** — Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/metaCriativo.ts supabase/functions/_shared/metaCriativo.test.ts
git commit -m "Hash e versionamento de criativo"
```

---

### Task 7: Edge function `meta-sync-ads`

**Files:**
- Create: `supabase/functions/meta-sync-ads/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `metaGraph.ts`, `metaMapear.ts`, `metaCriativo.ts`.
- Produces: endpoint com `{ action: 'enfileirar' | 'drenar', since?, until? }`.

- [ ] **Step 1: `action: 'enfileirar'`**

Cria jobs para toda conta com `coletar_nivel_ad = true`, em janelas de 7 dias. `base` e `criativo` cobrem 180 dias; `plataforma` e `demografia`, 90 — a janela segue a retenção de cada passe, senão o backfill coleta o que o expurgo apaga na primeira execução. `on conflict do nothing` na chave única torna reenfileirar idempotente.

- [ ] **Step 2: `action: 'drenar'`**

Pega jobs `pending`/`failed` na ordem `base` → `criativo` → `plataforma` → `demografia`, mais antigos primeiro. Marca `running`, trabalha até o orçamento de tempo interno (~50s), grava `cursor_paginacao` e devolve o resto. Erro incrementa `tentativas` e volta para `failed`; na quinta tentativa vai para `dlq`.

- [ ] **Step 3: Registrar em `config.toml`** — a função é chamada por cron com a service key, então `verify_jwt` segue o padrão das demais funções internas.

- [ ] **Step 4: Verificar de verdade, contra a conta real**

```bash
npx supabase functions deploy meta-sync-ads
# enfileirar só uma semana, para conferir antes de soltar 180 dias
curl -s -X POST "$SUPABASE_URL/functions/v1/meta-sync-ads" \
  -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -d '{"action":"enfileirar","since":"2026-08-25","until":"2026-08-31"}'
curl -s -X POST "$SUPABASE_URL/functions/v1/meta-sync-ads" \
  -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -d '{"action":"drenar"}'
```

Expected: jobs saem de `pending` para `done`, `meta_insights_ad` ganha linhas.

- [ ] **Step 5: Conferir o aceite que mais importa**

No SQL editor: `select sum(spend) from meta_insights_ad where data between '2026-08-25' and '2026-08-31';`
Expected: bate com o Gerenciador de Anúncios no mesmo período. Se não bater, **parar** — todo o resto da página se apoia neste número.

- [ ] **Step 6: Conferir idempotência**

Rodar `drenar` de novo sobre a mesma janela e conferir que a contagem de linhas não muda.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/meta-sync-ads/ supabase/config.toml
git commit -m "Coleta da Meta em nivel de anuncio, com fila e retomada"
```

---

### Task 8: Cron e expurgo

**Files:**
- Create: `supabase/migrations/20260901330000_trafego_cron.sql`

- [ ] **Step 1: Escrever a migração**

Segue o padrão de `20260831230000_zap_agendamento.sql` (função que agenda, em vez de `cron.schedule` solto na migração). Dois jobs: `drenar` a cada 5 minutos; e um diário que reenfileira os últimos 10 dias e roda o expurgo.

```sql
-- Reenfileirar 10 dias todo dia não é desperdício: a janela de atribuição da
-- Meta reescreve o passado recente, e sem reler a página diverge do Gerenciador
-- de forma permanente e inexplicável.
```

- [ ] **Step 2: Aplicar e verificar** — `select jobname, schedule from cron.job;`

- [ ] **Step 3: Commit**

---

### Task 9: RPCs de agregação

**Files:**
- Create: `supabase/migrations/20260901340000_trafego_rpcs.sql`

**Interfaces:**
- Produces: `trafego_visao_geral(p_inicio date, p_fim date, p_conta text)`, `trafego_hierarquia(...)`, `trafego_criativos(...)`, `trafego_recorte(..., p_recorte text)`.

- [ ] **Step 1: Escrever as funções**

`security invoker` para o RLS valer. `trafego_visao_geral` devolve período atual e anterior de uma vez — evita duas viagens. Nenhuma devolve CAC ou ROAS: sem atribuição, não são mensuráveis.

- [ ] **Step 2: Medir sob `authenticated`**

Com sessão real de um usuário com o papel `trafego` (não `service_role`):

```sql
explain analyze select * from trafego_visao_geral('2026-08-01','2026-08-31','act_...');
```

Expected: abaixo de 1s. Acima disso, conferir se a política está com a subconsulta escalar antes de mexer em índice.

- [ ] **Step 3: Commit**

---

### Task 10: Hook `useFunilTrafego`

**Files:**
- Create: `src/hooks/useFunilTrafego.ts`

**Interfaces:**
- Consumes: as quatro RPCs da Task 9.
- Produces: `useFunilTrafego(filtros)` devolvendo `{ visaoGeral, hierarquia, criativos, recorte, conta, ultimaColeta, carregando, erro }`.

Segue o formato de `src/hooks/useZapInteligencia.ts`: uma query por RPC, agregação no banco. Nada de recalcular funil no cliente.

- [ ] **Step 1: Implementar**
- [ ] **Step 2: Verificar** — `npm run build` sem erro de tipo.
- [ ] **Step 3: Commit**

---

### Task 11: Página e componentes

**Files:**
- Create: `src/pages/FunisTrafegoPago.tsx`
- Create: `src/components/trafego/CabecalhoTrafego.tsx`
- Create: `src/components/trafego/VisaoGeralTrafego.tsx`
- Create: `src/components/trafego/HierarquiaAnuncios.tsx`
- Create: `src/components/trafego/CriativosPainel.tsx`
- Create: `src/components/trafego/SecaoPendente.tsx`
- Modify: `src/App.tsx` (rota `/funis-trafego-pago`)
- Modify: `src/components/Navigation.tsx` (item em Análise, abaixo de Anúncios)

- [ ] **Step 1: `CabecalhoTrafego`** — período, conta, base (N) e frescor da coleta. É o §7 do spec: a página abre dizendo de que período e de qual conta fala.

- [ ] **Step 2: `SecaoPendente`** — componente reutilizável para os blocos 4 e 5, e para os cartões de CAC e ROAS. Recebe título e motivo, e renderiza visualmente distinto do que é medido. É o que impede confundir bloqueado com zero.

- [ ] **Step 3: `VisaoGeralTrafego`** — investimento, impressões, cliques, CTR, frequência, leads, CPL, variação vs. período anterior. CAC e ROAS via `SecaoPendente`, com o motivo "requer atribuição lead↔venda (fase 4)".

- [ ] **Step 4: `HierarquiaAnuncios`** — campanha → conjunto → anúncio, navegável. Ranking por CPL, CTR, frequência, custo por resultado. Coluna de qualidade do lead desabilitada, com motivo.

- [ ] **Step 5: `CriativosPainel`** — copy no ar ao lado do desempenho, casando `vigente_desde`/`vigente_ate` com o período exibido.

- [ ] **Step 6: Rota e navegação** — item em Análise abaixo de Investimento em Anúncios, visível só para quem tem o papel `trafego`.

- [ ] **Step 7: Verificar** — `npm run build`, depois abrir a página e conferir: cabeçalho declara período e conta; CAC/ROAS bloqueados com motivo; blocos 4 e 5 declarados vazios.

- [ ] **Step 8: Commit**

---

## Desvio deliberado do spec

O §4.4 do spec prevê que `meta-sync-insights` passe a usar o módulo compartilhado
também. Não há tarefa para isso aqui, de propósito: essa função sustenta a página que
está em produção, e refatorá-la por DRY, sem nenhum ganho de comportamento nesta fase,
é risco sem contrapartida. O módulo nasce compartilhável e a função nova o usa; migrar
a antiga fica para quando houver motivo de comportamento — provavelmente a consolidação
já registrada como não-objetivo.

## Ordem e independência

Tasks 1–3 são fundação. Tasks 4–6 são lógica pura testável e podem ser feitas em qualquer ordem entre si. Task 7 depende de 4–6. Tasks 9–11 dependem de haver dado, portanto de 7.

O aceite decisivo é o Step 5 da Task 7: se `sum(spend)` não bate com o Gerenciador, nada adiante vale a pena.
