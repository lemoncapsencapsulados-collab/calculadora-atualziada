# Funis de Tráfego Pago — desenho da fase C (Meta em nível de anúncio + criativo)

Data: 2026-09-01
Rota: `/funis-trafego-pago`, em Análise, abaixo de Investimento em Anúncios.

Escopo deste documento: **apenas a fase C**. As demais fases do prompt original
(`docs/prompt-funis-trafego-pago.md`) seguem válidas e não são canceladas por este
desenho — são adiadas, com os motivos registrados na seção "Pendências declaradas".

---

## 1. O que foi apurado antes de desenhar

Levantamento feito sobre o código, não sobre suposição. Cada afirmação abaixo tem
arquivo e linha, porque várias delas contrariam o que o prompt original assumia.

### 1.1 Não existe, e nunca existiu, atribuição lead↔campanha

O prompt (§2) supunha que a resposta dependia de os anúncios serem Click-to-WhatsApp.
Não são. O fluxo real, confirmado com o dono do produto:

```
anúncio Meta -> landing page -> formulário -> automação n8n -> grupo de leads no
WhatsApp -> consultor inicia a conversa individual
```

Consequências apuradas:

- `supabase/functions/_shared/zapNormalizar.ts` lê `extendedTextMessage.text` e
  **descarta o `contextInfo` inteiro**. `zap-webhook` não persiste payload cru.
  Mesmo que houvesse CTWA, o `referral` nunca teria entrado no acervo.
- `supabase/functions/_shared/evolution.ts:67` exclui `@g.us` no backfill, então o
  grupo de leads do n8n não está no histórico importado. **Ressalva:** o caminho do
  webhook (`zapNormalizar`) NÃO filtra grupo. Se o grupo estiver numa instância com
  webhook ligado, pode haver histórico de lead recuperável ali. Não verificado —
  exige consulta ao banco de produção.
- As 115 migrações não têm nenhuma tabela de lead nem coluna `utm_*`/`fbclid`.
  O formulário da landing não escreve neste Supabase.

### 1.2 O funil da página atual é coincidência temporal, não atribuição

`src/hooks/useAnunciosDados.ts:116-176` puxa `meta_insights` por intervalo de data e,
**separadamente**, puxa todos os `orcamentos` e todos os `pedidos` do mesmo intervalo.
Não há join entre eles. O agrupamento é por nome de consultor extraído do nome da
campanha (`detectarVendedorNaCampanha`).

Portanto o "Lead → Orçamento 6,9%" e o "CAC R$ 436,08" hoje em produção contam todo
orçamento do mês contra toda a verba do mês — indicação, cliente recorrente e
prospecção fria incluídos. É estimativa apresentada como medição. **Este desenho não
replica esse cálculo.**

### 1.3 A cadeia até a receita existe, e é determinística — quando houver a ponte

- `clientes.telefone` é `NOT NULL`.
- `orcamentos.cliente_id uuid REFERENCES clientes(id)` foi adicionado por `ALTER`
  posterior (portanto **anulável**; a taxa de preenchimento é desconhecida e é o
  número que decide quanto do funil é medível).
- `zap_contatos.telefone` só é preenchido para JID `@s.whatsapp.net`
  (`zapPersistir.ts:117`); `@lid` fica nulo.

Espinha de atribuição viável no futuro, sem nenhuma etapa estimada:

```
anúncio --fbclid/utm (GTM injeta no form)--> submissão --n8n--> tabela nossa
    |--telefone--> zap_contatos --> qualidade da conversa
    `--telefone--> clientes --> orcamentos.cliente_id --> pedidos --> receita
```

O GTM já está instalado na landing, e o n8n já troca dados com este sistema nos dois
sentidos (`src/hooks/usePedidos.ts:58`, `supabase/functions/asaas-webhook/index.ts:24`).
A ponte é configuração em ferramenta existente, não integração nova. **Não pertence a
esta fase**, mas quanto mais cedo for ligada, menor o buraco histórico — atribuição só
acumula para frente.

### 1.4 Instrumentação do site

A landing tem GTM. Não tem GA4 nem Clarity confirmados. Este repositório
(`index.html`) não tem instrumentação nenhuma, mas é o sistema interno, não a landing —
a ausência aqui não prova nada sobre lá.

GTM sozinho não produz métrica: a API v2 expõe configuração (contas, contêineres,
workspaces, tags, gatilhos, variáveis, versões, permissões). Serve para auditar
instrumentação. Sem GA4 não há fonte histórica de evento de site. O Clarity daria 1 a 3
dias por coleta, com 10 requisições por projeto por dia.

### 1.5 Escala real

Uma única conta de anúncio entra: **C.A – Lemon Caps**. Gasto de referência
R$ 5.233,00 em agosto/2026. Os 180 dias em nível de anúncio devem render poucos
milhares de linhas na base e algumas dezenas de milhares nos recortes. Não é problema
de escala — o que exige cuidado aqui é correção, não volume.

---

## 2. Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Ordem das fases | Meta nível anúncio primeiro (fase C) | Decisão do dono do produto. Entrega valor sem depender de atribuição. |
| RLS | Papel novo `trafego` | Segue o §3 do prompt. Controle real de quem vê custo de mídia. |
| Retenção | 180 dias na base, 90 nos recortes | A base permite leitura sazonal; os recortes são o volume. |
| CAC e ROAS na fase C | Cartão bloqueado, com motivo | Sem atribuição não são mensuráveis. Mostrar número frágil com selo de página nova propagaria o defeito de 1.2. |
| Contas coletadas | Só a da Lemon Caps, por chave em dado | `meta_ad_accounts.coletar_nivel_ad boolean default false`. |

---

## 3. Modelo de dados

Por migração, RLS com a chamada embrulhada em subconsulta escalar —
`using ((select has_role('trafego'::app_role)))`. Função nua no RLS é reavaliada linha
a linha; em `zap_mensagens` isso custou 63,8s contra 0,653s
(`20260901290000_zap_rls_initplan.sql`).

O papel `trafego` exige `ALTER TYPE public.app_role ADD VALUE 'trafego'`, que **não
roda dentro da transação da migração**. Precisa de migração isolada, aplicada antes das
que criam as políticas.

### 3.1 `meta_insights_ad` — a verdade base, somável

Chave única: `(ad_account_id, ad_id, data)`. **Sem breakdown.** É a única tabela sobre
a qual `sum(spend)` é correto.

```
ad_account_id text, ad_id text, data date,
campaign_id/campaign_name, adset_id/adset_name, ad_name,
spend, impressions, clicks, reach, frequency,
actions jsonb, action_values jsonb, cost_per_action_type jsonb,
leads integer  -- derivada, mantida por conveniência de consulta
```

`actions` fica cru. Foi exatamente descartá-lo em `meta_insights` que impediu de
responder "os leads são de messaging ou de Pixel?" sem chamar a API de novo.

### 3.2 `meta_insights_ad_recorte` — formato longo, nunca somar entre recortes

Chave única: `(ad_account_id, ad_id, data, recorte, chave_1, chave_2)`.

```
recorte text  -- 'plataforma_posicionamento' | 'idade_genero'
chave_1 text, chave_2 text,
spend, impressions, clicks, actions jsonb
```

A Meta devolve breakdowns como recortes independentes do MESMO gasto. Somar linha de
plataforma com linha de idade dobra o investimento. O prompt original (§3) propunha
chave única com plataforma e posicionamento na mesma tabela dos demais; o discriminador
`recorte` em formato longo torna esse erro visível na consulta em vez de silencioso, e
recorte novo passa a ser linha, não migração.

### 3.3 `meta_criativos` — com histórico de versão

Chave única: `(ad_id, hash_conteudo)`.

```
titulo, corpo, descricao, cta, url_destino,
image_url, video_id, object_story_spec jsonb,
hash_conteudo text,                     -- digest de texto + mídia
vigente_desde date, vigente_ate date    -- null = no ar
```

A coleta compara o hash com a versão vigente: igual, estende `vigente_ate`; diferente,
fecha a anterior e abre uma nova. É o que permite responder "qual copy estava no ar em
12/08" e comparar desempenho entre versões por join de data.

### 3.4 `meta_sync_jobs` — fila com checkpoint

Espelha `zap_backfill_jobs`. Chave única:
`(ad_account_id, passe, janela_inicio, janela_fim)`.

```
passe text    -- 'base' | 'criativo' | 'plataforma' | 'demografia'
status text   -- pending | running | done | failed | dlq
tentativas int, ultimo_erro text, cursor_paginacao text,
linhas_gravadas int, atualizado_em timestamptz
```

### 3.5 Expurgo

Rotina diária apaga `meta_insights_ad` com mais de 180 dias e
`meta_insights_ad_recorte` com mais de 90.

---

## 4. Coleta

### 4.1 Por que fila, mesmo com uma conta só

`meta-sync-insights` hoje faz tudo numa invocação: laço por conta, paginação sem
limite, sem backoff, sem retomada. Funciona em nível de campanha. Em nível de anúncio,
uma falha transitória no meio do backfill de 180 dias exigiria recomeço manual.

A fila **não** está aqui por escala — está por correção e retomada. Foram cortados por
YAGNI, depois de confirmada a conta única: subdivisão adaptativa de janela, governador
de consumo por conta e priorização entre contas.

Cada job cobre 7 dias. O executor pega os pendentes mais antigos, trabalha até um
orçamento de tempo interno, grava o cursor e devolve o resto para a fila. Estourar o
teto deixa de ser falha e vira mais uma rodada — mesmo raciocínio do `ultima_pagina` no
backfill do Zap.

### 4.2 Passes, em ordem de utilidade

1. `base` — `level=ad`, sem breakdown, `time_increment=1`. Sustenta os blocos 1 e 2.
2. `criativo` — `/ads?fields=id,name,adset_id,campaign_id,creative{...},status`.
   Configuração, não insights: sem janela de data.
3. `plataforma` — breakdown `publisher_platform,platform_position`.
4. `demografia` — breakdown `age,gender`.

Os passes 3 e 4 são enriquecimento: se atrasarem, a página funciona. Só 1 e 2 são
bloqueantes.

Correção ao §1 do prompt: os cinco breakdowns não cabem numa chamada. A Meta recusa boa
parte das combinações, e cruzar demografia com posicionamento estilhaça as linhas em
células suprimidas por privacidade. São coletas de perfis distintos — por isso passes
distintos e tabelas distintas. O fator não é ~50x numa chamada; são três coletas de
naturezas diferentes.

### 4.3 Dado da Meta não é imutável

A janela de atribuição reescreve o passado recente: o desempenho de um anúncio de
segunda continua sendo corrigido por dias. Portanto o cron diário **reenfileira os
últimos 10 dias**, com upsert sobrescrevendo. Sem isso a página diverge do Gerenciador
de forma permanente e inexplicável, e o aceite exige que batam.

O backfill é enfileirado uma vez como carga inicial e drena sozinho. A janela segue a
retenção de cada passe, não um número único: `base` e `criativo` cobrem 180 dias;
`plataforma` e `demografia`, 90. Enfileirar recorte além de 90 dias seria coletar o que
o expurgo apaga na primeira execução.

### 4.4 Estender, não duplicar

Nenhum OAuth novo, nenhuma tabela de contas nova, nenhum token novo. De
`meta-sync-insights` extrai-se `_shared/meta.ts` (chamada ao Graph com backoff, leitura
dos cabeçalhos de uso `X-Business-Use-Case-Usage` / `X-Ad-Account-Usage`, registro de
erro na conta), usado pelas duas funções. A coleta de anúncio é `meta-sync-ads`,
separada, porque enfiar um executor de fila multi-passe na função síncrona atual
pioraria as duas — e a de campanha precisa continuar intacta, já que a página em
produção depende dela.

Não-objetivo registrado: com `meta_insights_ad` completa, `meta_insights` de campanha
passa a ser derivável por agregação. Consolidar as duas é simplificação real, mas mexe
na página no ar e não pertence a esta fase.

---

## 5. A página

Hook `useFunilTrafego.ts` chamando RPCs SQL, no formato de `useZapInteligencia`: uma
função por métrica, agregação no banco, o navegador só desenha. Nada de recalcular
funil no cliente.

RPCs: `trafego_visao_geral`, `trafego_hierarquia`, `trafego_criativos`,
`trafego_recorte`.

**Cabeçalho** declara sempre período, conta, base e frescor:
"01/08 — 31/08/2026 · C.A – Lemon Caps · N=1.327 leads · última coleta há 2h".

**Bloco 1 — visão geral.** Medidos: investimento, impressões, cliques, CTR, frequência,
leads (como a Meta os conta), CPL e variação vs. período anterior. **CAC e ROAS
aparecem como cartões bloqueados**, com o motivo: requerem atribuição lead↔venda,
fase 4.

**Bloco 2 — campanha → conjunto → anúncio**, navegável em profundidade. Ranking por
CPL, CTR, frequência e custo por resultado. O ranking por qualidade do lead pedido no
§4.2 do prompt fica como coluna desabilitada com motivo visível — depende da fase 4.

**Bloco 3 — criativos e copy.** Cada anúncio com o texto que estava no ar ao lado do
desempenho, casando `vigente_desde`/`vigente_ate` com o período exibido. Sem opinião de
IA (isso é o §5 do prompt, fase 5).

**Blocos 4 e 5** entram como seções declaradas vazias, com o motivo à vista:

- "Comportamento no site — sem fonte: a landing tem GTM, não tem GA4 nem Clarity."
- "Qualidade do lead — requer atribuição lead↔campanha."

Estado declarado, não promessa e não omissão.

---

## 6. Pendências declaradas (fora do escopo desta fase)

1. **Ponte de atribuição** — GTM injetando `fbclid`/`utm_*` no formulário, nó do n8n
   gravando a submissão numa tabela nossa. Configuração em ferramentas que já existem.
   Urgente por acúmulo, não por complexidade.
2. **Contato em `orcamentos`** — coluna própria ou disciplina de preencher
   `cliente_id`, para a cadeia fechar até a receita. Medir antes a taxa de
   preenchimento atual.
3. **Verificar se o grupo de leads do n8n entrou em `zap_mensagens`** pelo caminho do
   webhook. Se entrou, há histórico de lead recuperável.
4. **GA4 e/ou Clarity na landing** — sem isso o bloco 4 não tem fonte.
5. **Auditoria de GTM** (`gtm_auditoria`), fase 3 do prompt.
6. **Parecer estratégico por IA** (`funil-parecer`), fase 5.
7. **Exportação PDF/PPTX** reaproveitando `src/lib/zapApresentacaoExport.ts`, fase 6.

---

## 7. Critérios de aceite

- Nenhum número sem base declarada na tela.
- Nenhuma consulta acima de 1s **sob o papel `authenticated`**. Testar com sessão real,
  nunca com `service_role`, que ignora o RLS e mede o caminho errado.
- Toda estimativa visualmente distinta de toda medição. Na fase C não há estimativa: o
  que não é medido aparece bloqueado, não aproximado.
- A página abre dizendo de que período e de qual conta fala.
- `sum(spend)` de `meta_insights_ad` no mês bate com o Gerenciador de Anúncios.
- Somar entre recortes diferentes é impossível sem passar pelo discriminador.
- Interromper a coleta no meio e reiniciar não duplica nem perde linha.

---

## 8. Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| `orcamentos.cliente_id` pouco preenchido | A fase 4 entrega menos do que promete | Medir a taxa antes de desenhar a fase 4 |
| Recorte somado com a base por engano | Investimento dobrado, silenciosamente | Tabelas separadas + discriminador `recorte` |
| Divergência com o Gerenciador | Perda de confiança na tela inteira | Reenfileirar os últimos 10 dias todo dia |
| `ALTER TYPE` do papel em migração transacional | A migração falha ao aplicar | Migração isolada, antes das políticas |
| Atraso na ponte de atribuição | O buraco histórico cresce todo dia | Registrado como pendência 1, independente desta fase |
