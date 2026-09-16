# Prompt — Funis de Tráfego Pago (Lemon Caps)

Construa uma nova aba em **Análise → Funis de Tráfego Pago**, abaixo de "Investimento em Anúncios", em `/funis-trafego-pago`. É a página do gestor de tráfego / estrategista de funil: junta gasto, criativo, comportamento no site e qualidade do lead no WhatsApp numa leitura só, e propõe ação.

---

## 0. O que JÁ existe — reaproveite, não refaça

| Ativo | Onde | O que já entrega |
|---|---|---|
| OAuth da Meta | `supabase/functions/meta-oauth` | BM e contas de anúncio conectadas (21 contas) |
| Sync de insights | `supabase/functions/meta-sync-insights` | **só `level: 'campaign'`**, campos `campaign_id, campaign_name, spend, impressions, clicks, actions, date_start` |
| Tabelas | `meta_ad_accounts`, `meta_insights` | granularidade de campanha/dia, 12 colunas |
| Página atual | `src/pages/InvestimentoAnuncios.tsx`, `src/hooks/useAnunciosDados.ts` | funil Lead→Orçamento→Venda cruzando `meta_insights` + `orcamentos` + `pedidos` |
| IA de anúncios | `supabase/functions/anuncios-insights-ia` | análise já existente sobre campanhas |
| ZapVendas | `zap_contatos`, `zap_mensagens`, `zap_turnos_cache`, `zap_conversa_analise` | 66k mensagens, 800+ conversas com sentimento, objeções e etapa de funil por IA |

A nova página **não** cria uma segunda integração com a Meta. Ela estende a que existe.

---

## 1. Realidade de cada integração — leia antes de prometer tela

Isto não é pessimismo, é o que as APIs devolvem. Um desenho que ignore estes limites nasce quebrado.

**Meta (BM + conta de anúncios) — a base sólida.**
Hoje a sync roda em `level: 'campaign'`. Para analisar "cada anúncio e cada copy" é preciso subir para `level: 'ad'` e pedir `ad_id, ad_name, adset_id, adset_name, creative{body,title,image_url,object_story_spec}, actions, action_values, cost_per_action_type`, com breakdowns de `publisher_platform`, `platform_position`, `age`, `gender`, `device_platform`. Isso multiplica o volume de linhas por ~50x — dimensione tabela e janela de sync antes.

**Pixel da Meta — não é uma fonte separada.**
Não existe "API do Pixel" para navegação do site. O que o Pixel gera chega por dois caminhos: (a) `actions`/`action_values` do Ads Insights, já atribuídos ao anúncio — é o caminho bom; (b) Conversions API, que serve para *enviar* evento, não para ler. Não desenhe tela supondo que dá para puxar jornada de página pelo Pixel.

**Google Tag Manager — NÃO é fonte de dados.**
A API v2 do GTM expõe **configuração**: contas, contêineres, workspaces, tags, gatilhos, variáveis, versões, permissões. **Zero métrica.** Conectar o GTM serve para *auditar a instrumentação* — "o evento `Lead` tem gatilho? dispara em qual página? existe tag duplicada contando conversão duas vezes?" — que é diagnóstico valioso e explica furos no funil, mas nunca vai desenhar um gráfico. Se a página precisa de evento de site com histórico, a fonte é GA4 (Data API) ou evento próprio gravado por nós.

**Microsoft Clarity — limite severo, exige estratégia de acúmulo.**
A Data Export API dá: **10 requisições por projeto por dia**, **no máximo 3 dimensões por requisição**, **1.000 linhas**, e **só os últimos 1 a 3 dias**. Não há paginação nem plano pago que amplie. Consequência: é impossível pedir histórico à Clarity. O único desenho que funciona é **cron diário que fotografa as fatias que interessam e grava em tabela nossa** — o histórico passa a ser nosso, construído dia a dia. Escolha as 3 dimensões com cuidado (sugestão: `Page URL` + `Device` + `Source`; e uma segunda fatia com `Page URL` + rage click / dead click / scroll depth). Existe também um Clarity MCP Server — avalie se cabe.

---

## 2. A pergunta que decide metade desta feature

O pedido "qualidade dos leads por campanha" exige ligar **uma conversa de WhatsApp ao anúncio que a gerou**. Hoje isso é impossível: no `zap-webhook` e no `zapNormalizar.ts` **nenhum campo de origem é capturado** — não há `referral`, `ctwa_clid`, `source_id` nem `sourceUrl` gravado em lugar nenhum.

Antes de construir, resolva:

1. Os anúncios são **Click-to-WhatsApp**? Se sim, a Evolution API entrega o objeto `referral` na mensagem de abertura (com `source_id` = id do anúncio, `ctwa_clid`, headline e body)? Investigue um payload real antes de assumir.
2. Se sim → grave esses campos em `zap_contatos` e a atribuição fica **determinística**. É de longe a melhor saída, e destrava tudo: CPL vira custo por *lead que respondeu*, por *lead que virou reunião*, por *lead que fechou*.
3. Se não → resta atribuição **temporal aproximada** (contato novo no mesmo dia de pico de uma campanha). É palpite, e deve aparecer na tela **marcado como estimativa**, nunca misturado com número medido.

**Não construa a seção de qualidade-de-lead-por-campanha sem responder isto.** Entregue o resto e deixe essa seção explicitamente pendente.

---

## 3. Modelo de dados

Crie por migração, seguindo o padrão do projeto (RLS com `using ((select has_role(...)))` — função nua no RLS é reavaliada linha a linha e já custou 63s numa tela deste sistema):

- `meta_insights_ad` — insights em nível de anúncio/dia + breakdowns. Chave `(ad_account_id, ad_id, data, plataforma, posicionamento)`.
- `meta_criativos` — copy, título, mídia e `object_story_spec` por `ad_id`, **com histórico de versão** (criativo muda; comparar desempenho exige saber qual texto estava no ar quando).
- `clarity_snapshots` — foto diária: `(data, dimensao_1..3, sessoes, rage_clicks, dead_clicks, scroll_depth, tempo)`. É a tabela que compra o histórico que a API não dá.
- `gtm_auditoria` — retrato da configuração do contêiner: tags, gatilhos, variáveis, quando foi lida, e diff entre versões.
- `trafego_atribuicao` — a ponte lead↔anúncio decidida no §2, com coluna `origem` dizendo se a ligação é `deterministica` ou `estimada`.

Toda métrica derivada em SQL, como no ZapVendas. Nada de recalcular funil no navegador.

---

## 4. A página

Cinco blocos, nesta ordem de leitura — dinheiro, criativo, site, lead, ação:

1. **Visão geral** — investimento, CPL, CAC, ROAS, variação vs. período anterior e a base (`N=1.327`) sempre visível.
2. **Campanha → conjunto → anúncio**, navegável em profundidade. Ranking por CPL *e* por qualidade do lead, não só por volume. Tabela e gráfico para a mesma pergunta.
3. **Criativos e copy** — cada anúncio com o texto que está no ar ao lado do desempenho. É aqui que a IA opina sobre a copy, com o número ao lado.
4. **Comportamento no site** (Clarity + GTM) — onde a página perde gente: rage click, dead click, scroll morto, e a auditoria de instrumentação apontando evento que não dispara.
5. **Qualidade do lead** (ZapVendas) — sentimento, objeção e etapa de funil das conversas de cada campanha. Responde o que o CPL sozinho não responde: *o lead barato é lead bom?*

Marque **toda** etapa que dependa de julgamento de IA, como já se faz no ZapVendas (`deterministica: false`). Misturar contagem com palpite sem avisar é o pior erro possível aqui.

---

## 5. A camada de estrategista

Uma edge function `funil-parecer` que **lê os números já apurados** — nunca relê dados crus a cada clique, pelo mesmo motivo que `zap-parecer` não relê conversas: custo que se paga uma vez não pode virar custo recorrente. Ela produz:

- Onde o funil vaza, com a etapa e o tamanho da perda em número absoluto.
- Diagnóstico por página e por copy, cada afirmação amarrada a uma métrica.
- Plano de ação priorizado: ação, métrica-alvo, valor atual, meta, prazo.
- Leitura holística: o que a combinação Meta + site + conversa diz que nenhuma das três diz sozinha.

**Regras inegociáveis** (herdadas do que já funciona aqui):
- Todo número no texto tem de existir nas métricas. Rode o validador de órfãos que o `zap-apresentacao` já usa.
- Nunca afirmar sobre dado ausente. Sem atribuição, a IA diz "não é possível afirmar" — não inventa correlação.
- Sempre citar a base. "Conversão de 12%" sem `N` é enganoso.
- Separar medido de inferido em toda frase.

Esforço de raciocínio **alto** aqui (é argumentação) e **baixo** em qualquer classificação em volume — a `zap-analisar` ganhou 12x de velocidade exatamente assim.

---

## 6. Entrega em fases

Não entregue em bloco único. Cada fase precisa ficar de pé sozinha:

1. Meta em nível de anúncio + criativo (sustenta todo o resto).
2. Clarity com cron de acúmulo diário.
3. Auditoria do GTM.
4. Atribuição lead↔campanha — **se e somente se** o §2 for resolvido.
5. Parecer estratégico por IA.
6. Exportação PDF/PPTX reaproveitando `src/lib/zapApresentacaoExport.ts`.

## 7. Aceite

- Nenhum número na tela sem base declarada.
- Nenhuma consulta acima de 1s sob papel `authenticated` — teste **sob RLS**, não com `service_role`, que ignora as políticas e mede o caminho errado.
- Toda estimativa visualmente distinta de toda medição.
- A página abre dizendo de que período e de qual conta está falando.
- Custo de IA exibido antes de gastar.

## 8. Responda antes de começar

1. Os anúncios são Click-to-WhatsApp? Existe `referral` no payload real da Evolution?
2. Existe GA4 instalado? (muda tudo no bloco de comportamento de site)
3. Quantas das 21 contas de anúncio entram nesta análise?
4. Qual o ID do projeto Clarity e já existe token de API gerado?
5. Quantos contêineres GTM, e quem tem permissão de leitura?
