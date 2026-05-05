
## Objetivo

1. **Histórico do Painel Administrador**: visualização tipo "diff" com destaque dos campos alterados e impacto estimado nos custos.
2. **Prazo de Preços (20 dias)**: ao salvar uma alteração no Painel Administrador, todos os orçamentos, fórmulas e precificações ficam com uma "janela de correção" de 20 dias. Durante esse período, aparece uma notificação em cada item. Vencido o prazo, o sistema recalcula automaticamente o preço dos orçamentos (somente os que ainda não foram aprovados/pagos) com base na nova configuração.

---

## Parte 1 — Diff visual no Histórico

**Arquivo:** `src/components/admin/HistoricoAlteracoes.tsx` (refactor)

Já temos a base (lista + dialog). Vamos enriquecer:

- **Linha da tabela**: além dos chips de campos alterados, mostrar uma coluna "Impacto estimado" com a variação percentual média do custo unitário (média ponderada pelas capacidades dos 4 tipos), com ícone ▲ verde (aumento) ou ▼ vermelho (queda).
- **Dialog de detalhes**:
  - Cabeçalho com data/hora, usuário e badge "Prazo de preços vence em X dias" (se aplicável).
  - Bloco "Variáveis estruturais": tabela lado a lado (Antes | Depois | Δ R$ | Δ %) com linhas alteradas destacadas em amarelo, inalteradas com opacidade reduzida.
  - Bloco "Custo unitário derivado por tipo" (Encapsulados / Solúvel / Gummy / Líquido): comparação de MOD e Admin antes/depois, recalculados via `calcularCustosPorTipo()`, mostrando Δ R$/un e Δ %.
  - Bloco "Simulação de impacto no preço": para cada tipo, simular um produto-referência (custo MP+Embalagem fictícios = R$ 10,00) usando `calcularPrecificacaoPorPreco` com config antiga vs nova → mostrar Δ no `totalCustosProducao` e na `margemLucroPercentual`. Útil para o usuário entender o efeito real.
  - Botão "Restaurar este snapshot" (já preenche o form com os valores antigos — sem auto-salvar).

---

## Parte 2 — Prazo de Preços de 20 dias

### 2.1 Banco de dados (migration)

Tabela nova **`prazo_precos`** (uma linha por evento de alteração da config):
- `id uuid pk`
- `historico_id uuid` → FK lógica para `historico_configuracao_custos.id`
- `configuracao_id uuid`
- `snapshot jsonb` (config nova já normalizada)
- `data_inicio timestamptz` (now)
- `data_fim timestamptz` (now + 20 dias)
- `aplicado boolean default false` (se já recalculou orçamentos)
- `aplicado_em timestamptz`
- `created_at`

Adicionar colunas em **`orcamentos`**:
- `prazo_preco_id uuid` (último prazo notificado/aplicado a este orçamento)
- `preco_recalculado_em timestamptz`
- `preco_anterior_recalculo numeric` (para histórico/auditoria)

Adicionar coluna em **`precificacoes`**:
- `prazo_preco_id uuid`
- `preco_anterior_recalculo numeric`
- `preco_recalculado_em timestamptz`

Adicionar coluna em **`formulas`**:
- `prazo_preco_id uuid` (apenas para badge de notificação na UI)

RLS: `authenticated` para tudo (segue padrão do projeto).

### 2.2 Disparo do prazo

Em `VariaveisEstruturaisForm.handleSalvar`, após `registrarHistorico`:
- Inserir linha em `prazo_precos` com `data_fim = now + 20 dias`.
- Marcar `prazo_preco_id` em **todos** os orçamentos com status diferente de `aprovado`, `pago` e `cancelado`, em **todas** as `precificacoes` ainda vinculadas a fórmulas ativas, e em **todas** as `formulas`.
- Toast: "Prazo de preços iniciado — vence em 20 dias".

### 2.3 Notificação visual ("janela de correção")

Componente novo `src/components/PrazoPrecoBadge.tsx`:
- Recebe `prazoPrecoId` ou `dataFim`.
- Renderiza badge amarelo "Prazo de preços: X dias restantes" (verde se >10d, amarelo 4-10d, vermelho ≤3d).
- Tooltip explicando: "Os custos foram alterados em DD/MM. Após DD/MM, este orçamento será recalculado automaticamente."

Inserir o badge em:
- **Cards de fórmula** em `Calculator.tsx` / `PrecificacoesSalvas.tsx` / `VerFormulaDialog.tsx`.
- **Cards de orçamento** em `Orcamentos.tsx` e `OrcamentoKanbanView.tsx`.
- **Linha de precificação** em `PrecificacoesSalvas.tsx`.

Hook novo `src/hooks/usePrazoPrecoAtivo.ts`:
- `usePrazoPrecoAtivo(prazoId)` → retorna `{ prazo, diasRestantes, vencido }`.
- `usePrazosAtivos()` → retorna lista dos prazos não aplicados (para banner global).

Banner global em `Navigation.tsx` (ou topo das páginas): "⚠ Prazo de preços ativo — vence em X dias. Y orçamentos serão recalculados."

### 2.4 Recálculo automático ao vencer

Estratégia **client-side lazy** (sem cron/edge function):

`src/lib/aplicarPrazoPreco.ts`:
- `aplicarPrazoPrecoVencido(prazoId)`:
  1. Busca `prazo_precos` onde `data_fim <= now()` e `aplicado = false`.
  2. Para cada um:
     - Carrega config atual.
     - Lista todos os `orcamentos` com `prazo_preco_id = X` e status em (`rascunho`, `enviado`, `em_negociacao`).
     - Para cada orçamento:
       - Itera `itens_producao[]`. Cada item tem `formula_id` (ou snapshot de custos). Recalcula `preco_venda` chamando `calcularPrecificacaoPorPreco` com novos custos derivados (MOD, Admin, Energia, Depreciação, Taxa de Perca via tipo do produto).
       - Atualiza `subtotal_producao`, `valor_total`, salva `preco_anterior_recalculo`, `preco_recalculado_em`.
     - Faz o mesmo nas `precificacoes` (substitui `preco_venda` mantendo o `markup_bruto` original).
     - Marca `prazo.aplicado = true`, `aplicado_em = now()`.

Disparo:
- Hook `useAplicarPrazoVencido` montado uma vez no `App.tsx` (nível global, pós-auth). Roda na montagem e a cada 5 min via `setInterval`. Idempotente.
- Toast de sumário: "X orçamentos recalculados pelo Prazo de Preços de DD/MM".

### 2.5 Comportamento e edge cases

- Orçamentos `aprovado`, `pago` e `cancelado` **nunca** são recalculados (preço travado no momento da aprovação).
- Se uma nova alteração for salva enquanto outro prazo está ativo: o prazo antigo é encerrado (`aplicado = true`, sem recálculo) e o novo `prazo_preco_id` substitui o anterior em todos os itens — mantém apenas a alteração mais recente como "fonte da verdade".
- Fórmulas e precificações: badge informativo apenas; o recálculo automático afeta apenas `orcamentos` e `precificacoes`. Fórmulas em si não têm preço, então não há recálculo de preço — apenas a notificação some quando o prazo vence.
- Auditoria: a tabela `prazo_precos` mantém o histórico de aplicações; cada orçamento guarda `preco_anterior_recalculo`.

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/components/PrazoPrecoBadge.tsx`
- `src/components/PrazoPrecoBanner.tsx` (banner global)
- `src/hooks/usePrazoPrecoAtivo.ts`
- `src/hooks/useAplicarPrazoVencido.ts`
- `src/lib/aplicarPrazoPreco.ts`
- Migration: criar tabela `prazo_precos` e colunas adicionais em `orcamentos` / `precificacoes` / `formulas`.

**Arquivos a editar:**
- `src/components/admin/HistoricoAlteracoes.tsx` (diff visual rico)
- `src/components/admin/VariaveisEstruturaisForm.tsx` (dispara prazo após salvar)
- `src/App.tsx` (montar `useAplicarPrazoVencido` + banner)
- `src/pages/Orcamentos.tsx`, `src/components/OrcamentoKanbanView.tsx` (badge no card)
- `src/pages/Calculator.tsx`, `src/components/PrecificacoesSalvas.tsx`, `src/components/VerFormulaDialog.tsx` (badge)
- `src/types/precificacao.ts` (adicionar campos `prazo_preco_id` etc.)

**Reuso de cálculo**: o recálculo automático usa as mesmas funções `calcularPrecificacaoPorPreco` / `calcularCustosPorTipo` já em produção, garantindo paridade com o que o usuário vê na Calculadora.

**Compatibilidade**: arredondamento sempre via `arredondarReais` (regra do projeto). Datas em ISO. Upserts com `.limit(1)` quando aplicável.
