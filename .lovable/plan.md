# Trava só no catálogo + Ajuste de preço no orçamento

## Objetivo
1. **Apenas para fórmulas do catálogo** (precificações cujo `formulas.cliente` é "Catálogo"): bloquear **Duplicar** e **Editar preço de venda**. Demais precificações de clientes continuam editáveis e duplicáveis como hoje.
2. No **GerarOrcamentoDialog (Etapa 2 — Itens de Produção)**: vendedor pode editar o **preço unitário** de cada item por negociação, com **margem recalculada ao vivo** e **trava de margem mínima** por tipo (liberação via senha padrão). O preço padrão do produto no catálogo **não é alterado** — a mudança vive apenas no orçamento.

---

## Mudanças por arquivo

### `src/components/PrecificacoesSalvas.tsx`
- Criar helper `const ehCatalogo = (p) => (p.formulas?.cliente || '').toLowerCase().includes('catálogo') || (p.formulas?.cliente || '').toLowerCase().includes('catalogo');` (ou usar a prop `catalogoOnly` quando já vier filtrada).
- No card de cada precificação:
  - Renderizar os botões **"Duplicar"** e **"Editar"** (que abre `EditarPrecificacaoDialog`) **somente quando `!ehCatalogo(precificacao)`**.
  - Para itens do catálogo, exibir uma badge/tooltip discreta tipo "Preço padrão — ajuste no orçamento".
- Manter intacto todo o fluxo para precificações que **não** são do catálogo (duplicar e editar preço continuam funcionando).

### `src/components/GerarOrcamentoDialog.tsx` — Etapa 2 (Itens de Produção)
- Em `handleAddPrecificacoes`, ao montar cada `ItemProducao`, guardar no estado local (sem mudar tipos persistidos) campos auxiliares vindos do `prec`:
  - `preco_venda_original` (= `prec.preco_venda`)
  - `total_custos_producao` (custo unitário)
  - `tipo_produto` (já existe via `segmento`)
- No card de cada item do array `itensProducao` (bloco linhas 840–910):
  - Adicionar `Input` de **Preço unitário** editável ao lado da Quantidade.
  - Ao alterar:
    - `subtotal = preco * quantidade` (com `arredondarReais`).
    - Calcular margem efetiva = `((preco - custoUnit) / preco) * 100` e validar com `validarMargemPorTipo(margem, segmento)`.
  - Exibir badge ao vivo com status/cor (verde/amarelo/vermelho/dourado) + percentual e a faixa ideal/mínima do tipo.
  - Botão pequeno **"Restaurar preço padrão"** que volta para `preco_venda_original`.
- **Bloqueio por margem mínima**:
  - Se o preço digitado gerar margem < mínima, abrir o diálogo de senha existente (`senhaMargemOrcDialog` + `SENHA_LIBERACAO_MARGEM = '0B%s8QP2Z+Do'`).
  - Marcar o item no `margemOrcLiberadaIds` quando liberado; sem liberação, reverter para o último preço válido e exibir toast.
  - Validar também antes de avançar para a próxima etapa.
- **Importante**: nenhuma alteração na tabela `precificacoes` — o preço editado vive apenas em `orcamentos.itens_producao` (snapshot do orçamento). O catálogo permanece com o preço padrão.

### Sem mudanças
- `EditarPrecificacaoDialog.tsx` continua existindo para precificações de clientes (não-catálogo).
- Nenhuma migração de banco.
- Tipos em `src/types/orcamento.ts` permanecem; campos auxiliares ficam só no estado React do dialog.

---

## Detalhes técnicos
- Para itens **avulsos** (sem `precificacao_id`/sem custo conhecido): permitir editar preço livremente, **sem** badge de margem nem bloqueio.
- POD: edição de preço permitida (afeta recompras/exibição); subtotal continua zerado pela regra atual.
- Todos os cálculos em BRL usam `arredondarReais`.
- A senha e a UX de liberação seguem o padrão já existente no fluxo (mesmo dialog/estado reutilizados).
