
## Objetivo
Adicionar uma seção completa de **Investimento em Anúncios** (topo de funil / tráfego pago) e cruzar esses dados com as métricas de vendas já existentes, alimentando o funil completo dentro da "Análise Apurada do Vendedor" no Dashboard.

## 1. Backend (Lovable Cloud) — 2 tabelas novas

`public.ad_investments`
- `canal` (text, ex: `meta_ads_whatsapp`)
- `data_inicio` (date), `data_fim` (date)
- `investimento_total` (numeric(15,2))
- `objetivo_campanha` (text, enum-like: mensagem_consultor, direct_instagram, view_video, engajamento_video, visitas_perfil, novos_seguidores)
- `observacoes` (text, nullable)
- id, created_at, updated_at, created_by (nullable)

`public.ad_investment_consultores`
- `ad_investment_id` (uuid FK → ad_investments, on delete cascade)
- `consultor_id` (uuid FK → usuarios)
- `consultor_nome_snapshot` (text) — preserva o nome caso o consultor seja desativado/renomeado
- `leads_recebidos` (int, default 0)
- `investimento_direcionado` (numeric(15,2), default 0)
- id, created_at, updated_at
- unique (ad_investment_id, consultor_id)

RLS: seguir padrão das outras tabelas do projeto (acesso a `authenticated`, GRANTs completos). CPL e taxas **nunca** persistidos — sempre calculados no frontend.

## 2. Nova rota `/investimento-anuncios`

Adicionar em `src/App.tsx` + link em `src/components/Navigation.tsx` (ícone `Megaphone` do lucide, label "Anúncios").

Página `src/pages/InvestimentoAnuncios.tsx` com:

**a) 4 KPIs no topo** (filtrados por período selecionado no topo da página):
- Total Investido | Total de Leads | CPL Médio | CAC (Investimento ÷ Vendas do período — vendas via `carregarAnaliseVendedor`/pedidos)

**b) Tabela de registros**: Período · Canal · Objetivo · Total Investido · Total de Leads · CPL Médio · Ações (editar/excluir)
- Ordenada por `data_inicio` desc, filtros por mês/ano e canal.

**c) Card expansível "Funil Completo por Consultor"**
- Para cada consultor ativo, cruza:
  - Leads (soma `leads_recebidos` dos registros no período)
  - Orçamentos gerados (query `orcamentos` por `consultor_responsavel` no período — mesma lógica de `analiseVendedor.ts`)
  - Vendas realizadas (query `pedidos` via `orcamento_snapshot->>consultor_responsavel` — mesma lógica)
- Exibe funil horizontal (barras decrescentes) + taxas Lead→Orç, Orç→Venda, Lead→Venda + CPL + Custo por Venda.

## 3. Modal "Novo Registro / Editar Registro"

Componente `src/components/anuncios/RegistroInvestimentoDialog.tsx`:
- Canal (Select) — só "Meta Ads → WhatsApp" hoje, arquitetura pronta para novos (constante `CANAIS_VENDAS`)
- Período (2 inputs `date` + resumo "X dias")
- Investimento Total (input monetário BRL, > 0)
- Objetivo (Select com as 6 opções)
- Distribuição por Consultor: lista automática via `useUsuarios(true)`; para edição, mescla com consultores desativados que já estão no registro (mostrados com badge "inativo"). Cada linha: leads (int) + investimento direcionado (BRL).
- Validação em tempo real da soma: mostra "R$ X ainda não distribuídos" (verde) ou "⚠ ultrapassa em R$ Y" (vermelho, bloqueia save).
- Totalizadores: Total de Leads, Total Distribuído, CPL geral.
- Observações (textarea).

## 4. Integração com o Dashboard (Análise do Vendedor)

Estender `src/lib/analiseVendedor.ts` para carregar Leads do consultor no mês (nova função `carregarLeadsPagosConsultor(consultorId, consultorNome, mes)`) — soma `leads_recebidos` + `investimento_direcionado` dos registros que interceptam o mês, ponderando por dias no mês quando necessário (implementação simples: soma cheia dos registros cujo `data_inicio` cai no mês).

Adicionar ao tipo `AnaliseVendedor`:
- `leadsPagos: number`
- `investimentoAnuncios: number`
- `cpl: number` (invest ÷ leads)
- `custoPorOrcamento: number` (invest ÷ qtdOrcamentos)
- `custoPorVenda: number` (invest ÷ qtdVendas)
- `taxaLeadOrcamento: number`, `taxaLeadVenda: number`

Atualizar `AnaliseVendedorDialog.tsx`:
- Novo card "Funil Completo" no topo (Leads → Orçamentos → Vendas com barras + taxas)
- Novos MetricCards: Leads Pagos, Investimento, CPL, Custo por Orçamento, Custo por Venda
- Refletir no CSV/PDF exportados
- Realtime: subscribe em `ad_investments` e `ad_investment_consultores` do mês.

## 5. Regras de integração
- Lista de consultores no formulário = `useUsuarios(true)` (ativos), reativo automaticamente.
- Consultores desativados **permanecem** nos registros históricos (via `consultor_nome_snapshot` + FK preservada), mas não aparecem em novos.
- `consultor_id` é o mesmo do Admin (`usuarios.id`), garantindo o join.
- CPL/taxas sempre recalculados, nunca gravados.

## Detalhes técnicos
- Novo hook `src/hooks/useAdInvestments.ts` com queries + mutations (create/update/delete) e invalidations do React Query.
- Constantes em `src/lib/anuncios.ts`: `CANAIS_VENDAS`, `OBJETIVOS_CAMPANHA`, helpers `calcularCPL`, `calcularFunil`.
- Formatação monetária: reaproveitar `formatBRL` de `analiseVendedor.ts`.
- Componente de funil horizontal: implementação simples com `div` + `bg-primary` proporcional (sem lib nova).
- Nenhuma alteração em pedidos/orçamentos existentes — só leitura para cruzar dados.

## Fora do escopo
- Importação automática do Meta Ads (só entrada manual por enquanto).
- Alocação automática de leads por dia (usa período informado como bloco).
