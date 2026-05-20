## Objetivo

No Painel Administrador (aba **Variáveis Estruturais**):

1. **Energia Elétrica** deixa de ser R$/unidade fixo e passa a ser **R$/mês ÷ capacidade por tipo**, igual ao cálculo da MOD. Cada tipo de produto (Encapsulado, Solúvel, Gummy, Líquido) terá seu próprio custo de energia por pote.
2. Adicionar uma seção de **Despesas Administrativas detalhadas** com tabela de 4 colunas: nome, custo mensal, diluído por tipo de pote e ações — com totais no rodapé. A soma dessas despesas substitui o atual campo único "Folha Administrativa".

---

## Mudanças

### 1. Banco de dados (migration)

Adicionar duas colunas em `configuracao_custos`:

- `energia_por_tipo jsonb NOT NULL DEFAULT '{}'` — `{ encapsulados, soluvel, gummy, liquido }` em R$/un.
- `despesas_admin_lista jsonb NOT NULL DEFAULT '[]'` — lista `[{ id, nome, custo_mensal }]`.

Campos legados (`energia_eletrica`, `despesas_administrativas`, `folha_administrativa`, `despesas_admin_por_tipo`) permanecem e continuam sendo gravados (média ponderada / soma) para compatibilidade com precificações antigas.

### 2. UI — `VariaveisEstruturaisForm.tsx`

- Remover o input fixo "Energia Elétrica (R$/un)" e o input "Folha Administrativa (R$/mês)".
- Nova seção **"Energia Elétrica mensal"**: um input único `R$/mês`. Card de derivados passa a mostrar **MOD + Energia + Admin** por tipo (Energia = energia_mensal ÷ capacidade_tipo).
- Nova seção **"Despesas Administrativas"** com tabela:

```text
| Nome da despesa | Custo mensal (R$) | Diluído por pote (Enc | Sol | Gum | Líq) | Ações |
| ...linhas editáveis com botão + adicionar / lixeira por linha...                         |
| TOTAL           | Σ mensais         | Σ/cap_enc | Σ/cap_sol | Σ/cap_gum | Σ/cap_liq      |
```

Botão "Adicionar despesa" cria nova linha vazia. Cada linha mostra em tempo real o custo diluído por tipo. Rodapé mostra total mensal e total por pote por tipo.

- Ao salvar: `folha_administrativa = soma(custo_mensal)`; `despesas_admin_por_tipo[k] = total ÷ capacidade[k]`; `energia_por_tipo[k] = energia_mensal ÷ capacidade[k]`; `energia_eletrica` (legado) = média ponderada por capacidade.

### 3. Cálculo — `src/lib/adminCustos.ts`

- Estender `getCustosParaTipo` para retornar também `energia`, lendo de `config.energia_por_tipo[k]` com fallback no legado `config.energia_eletrica`.
- Adicionar helper `calcularEnergiaPorTipo(energiaMensal, capacidades)` análogo ao de MOD/Admin.

### 4. Consumidores do custo de energia

Atualizar para usar `getCustosParaTipo(...).energia` em vez de `Number(config.energia_eletrica)`:

- `src/pages/Precificacao.tsx` (2 ocorrências em `useEffect`/recalc)
- `src/lib/aplicarPrazoPreco.ts` (recálculo em lote por prazo)
- `src/components/EditarPrecificacaoDialog.tsx` (manter valor salvo, mas ao recalcular usar o por tipo)
- `src/components/admin/HistoricoAlteracoes.tsx` (preview de variação considera energia por tipo + lista de despesas)

### 5. Histórico

- `HistoricoAlteracoes.tsx`: incluir `energia_por_tipo` e `despesas_admin_lista` no snapshot/diff (rótulos amigáveis e formatação de lista).
- O snapshot salvo no `prazo_precos` e em `historico_configuracao_custos` já é jsonb livre — só precisa incluir os novos campos no payload de salvar.

---

## Detalhes técnicos

- Reuso de `arredondarReais` em todas as divisões; tipos numéricos em centavos via `numeric`.
- IDs das linhas de despesa geradas com `crypto.randomUUID()` para keys estáveis na tabela.
- Sem novas migrações de RLS — colunas herdam policies de `configuracao_custos`.
- Sem alteração no shape de `precificacoes` — `custo_energia` e `custo_administrativo` continuam sendo gravados como R$/un já resolvido pelo tipo de produto.
- Backfill da migration: para configurações existentes, popular `energia_por_tipo` com o valor atual de `energia_eletrica` em todos os tipos, e `despesas_admin_lista` com uma única linha `{ nome: 'Folha Administrativa', custo_mensal: folha_administrativa }`.

---

## Fora de escopo

- Não altera o fluxo de catálogo / orçamento / negociação de preço (mantém regras existentes).
- Não mexe em impostos, taxa de perca, depreciação.
- Não toca em PDFs nem em snapshots de orçamentos/pedidos já fechados.