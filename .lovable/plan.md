## Objetivo

Simplificar a formação de preço para **MP + Embalagem + Overhead (R$ 3,00 configurável) + 12% de imposto sobre a venda**, e remover do Painel Administrador toda a área de custos/gastos e recálculo automático (Prazo de Preços). Precificações e orçamentos já salvos permanecem congelados com o valor atual.

## 1. Nova fórmula de precificação

Em `src/lib/precificacaoCalculator.ts`:

- Reescrever `calcularPrecificacaoPorPreco(custosBase, precoVenda, overhead)`:
  - `custoMateriaPrima = formula.total_mp`
  - `custoEmbalagem = formula.total_embalagem`
  - `overhead = 3.00` (vem da config)
  - `totalCustosProducao = MP + Embalagem + overhead`
  - `totalImpostos = precoVenda * 0.12`
  - `margemLucroValor = precoVenda - totalCustosProducao - totalImpostos`
  - `margemLucroPercentual = margemLucroValor / precoVenda * 100`
  - `markupBruto = (precoVenda - totalCustosProducao) / totalCustosProducao * 100`
  - Zerar campos legados (MOD, energia, depreciação, admin, ICMS detalhado, PIS/COFINS, IPI, IRPJ/CSLL, margem_segurança) preenchendo com `0` para manter compatibilidade com a tabela.
- Remover `calcularPrecificacaoPorMarkup` (não mais usado).
- Manter `validarMargemPorTipo` (regra de margens por tipo continua).

## 2. Tela de Precificação (`src/pages/Precificacao.tsx`)

Modo de entrada mantido: **usuário digita o preço, sistema mostra a margem**.

- Remover UI de custos indiretos editáveis (MOD, energia, depreciação, administrativo) e o cadeado/senha para editar esses valores.
- Remover import/uso de `getCustosParaTipo`, `custosIndiretos`, `updateConfiguracao` para custos.
- Ajustar breakdown da tela para mostrar apenas:
  - Custo MP, Custo Embalagem, Overhead R$ 3,00
  - Total de Custos
  - Imposto (12% sobre venda)
  - Preço de Venda, Margem R$, Margem %, Markup %
- `handleSalvar`: continuar gravando na tabela `precificacoes` com os campos novos preenchidos e os legados zerados.
- Remover badge/lógica de `prazo_preco_id` nesta tela.

## 3. Painel Administrador (`src/pages/PainelAdministrador.tsx`)

Manter apenas: **Consultores**, **Comissionamento**, **Histórico de Alterações**.

- Remover: `PrazoPrecoCountdown`, `PrazoItensVinculados`, `PrazosAtivosLista`, aba "Variáveis Estruturais" (`VariaveisEstruturaisForm`), hook `usePrazoNotificacoes`.
- Adicionar um card simples "Overhead de produção" com um único campo (R$) que grava em `configuracao_custos.overhead_unitario` (novo).
- Ajustar `TabsList` para 3 abas.

## 4. Overhead configurável

- Migration: `ALTER TABLE configuracao_custos ADD COLUMN overhead_unitario numeric(15,6) NOT NULL DEFAULT 3;`
- Novo hook mínimo (ou reaproveitar `useConfiguracaoCustos`) para ler/gravar apenas esse campo.
- Fallback: se `overhead_unitario` for nulo/0, usar 3.

## 5. Remover Prazo de Preços do restante do app

Componentes/hook/util a apagar:
- `src/components/PrazoPrecoBadge.tsx`
- `src/components/PrazoPrecoBanner.tsx`
- `src/components/admin/PrazoPrecoCountdown.tsx`
- `src/components/admin/PrazoItensVinculados.tsx`
- `src/components/admin/PrazosAtivosLista.tsx`
- `src/hooks/usePrazoPrecoAtivo.ts`
- `src/hooks/usePrazoNotificacoes.ts`
- `src/hooks/usePrazoItens.ts`
- `src/hooks/useAplicarPrazoVencido.ts`
- `src/lib/aplicarPrazoPreco.ts`

Em cada arquivo que importa esses símbolos (ex.: `App.tsx`, listagens de orçamentos, precificações salvas, layout com o banner), remover a importação e o uso — sem alterar o resto da lógica.

Tabela `prazo_precos` e colunas `prazo_preco_id` continuam existindo no banco, apenas não são mais lidas nem gravadas pelo app (registros congelados). Nenhuma migration destrutiva.

## 6. Fora de escopo

- Não altera cálculo de orçamentos/precificações já salvos (ficam congelados no valor atual).
- Não altera exportações de Pedidos/Excel.
- Não altera regras de comissão nem consultores.
- Não mexe em Edge Functions.

## Detalhes técnicos

- `configuracao_custos` continua existindo (usada por `updateConfiguracao` e histórico); só o subconjunto de campos exibidos muda.
- `usePrecificacao.salvarPrecificacao` mantém a mesma assinatura; os campos legados são gravados como `0`.
- A validação de margem por tipo (`validarMargemPorTipo`) e a senha `0B%s8QP2Z+Do` para salvar abaixo do mínimo continuam funcionando na tela de Precificação.
- Verificação após build: rodar o app, abrir /precificacao, digitar um preço em uma fórmula e conferir que o breakdown mostra somente MP, Embalagem, Overhead, Imposto 12% e Margem.
