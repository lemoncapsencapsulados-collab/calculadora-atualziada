## Objetivo

1. Incluir a cotação de frete (POD ou Estoque Próprio) como uma **seção dedicada** no PDF de "Orçamento" enviado ao cliente e no PDF de "Proposta para Contrato" — sem depender do preview manual, apenas do vínculo com o orçamento.
2. Simplificar o PNG baixado em Logística: mostrar apenas planos + preço/envio + dados gerais (produto, tipo, produtor, data e nº do orçamento). Remover colunas de Margem, Imposto, Frete e Manuseio separados.

## Mudanças

### 1. `src/lib/freteHelpers.ts` — novo helper de bloco para PDF
- Adicionar `blocoPdfFrete(cotacao)` que retorna estrutura pronta para render em jsPDF:
  - Cabeçalho: "Cotação de Frete — POD" ou "Estoque Próprio", com Produtor, Nº Orçamento e Data.
  - Para POD: tabela dos planos selecionados (`pod_planos_selecionados`) com colunas **Plano** e **Preço/Envio** apenas.
  - Para Estoque Próprio: linha única com valor do frete e status.
  - Rodapé com `Tipo de produto` e `Quant. envios mensais médio` (quando POD).
- Manter `linhaPdfFrete` como está (retrocompatibilidade), mas o PDF de orçamento passará a chamar o novo bloco.

### 2. `src/lib/orcamentoGenerator.ts` — seção completa no PDF do orçamento
- Substituir o parágrafo curto atual gerado a partir de `linhaPdfFrete` por uma **seção "Cotação de Frete"** renderizada logo após "Detalhamento de Frete/Envio":
  - Título + tabela (via `autoTable`) com colunas **Plano** e **Preço/Envio** para POD.
  - Para Estoque Próprio: linha simples com valor + status.
  - Se não houver cotação vinculada, seção é omitida (comportamento atual).
- Manter a busca já existente via `fetchFreteCotacaoByOrcamento(orcamento.id)`.

### 3. `src/lib/propostaGenerator.ts` — nova seção na Proposta para Contrato
- Importar `fetchFreteCotacaoByOrcamento` e `blocoPdfFrete`.
- Antes de finalizar o PDF (após "Condições de Pagamento" / antes das assinaturas), buscar a cotação vinculada ao orçamento e renderizar a mesma seção "Cotação de Frete" (POD ou Estoque Próprio) usando `autoTable` no mesmo padrão do orçamento.
- Se não existir cotação, seção é omitida.

### 4. `src/pages/Logistica.tsx` — PNG simplificado (`CotacaoExportCard`)
- Remover do card exportado:
  - Colunas **Frete**, **+ Manuseio**, **Margem**.
  - Linha de "Margem: X% · Imposto: Y%".
- Manter/adicionar:
  - Título "Cotação de Frete — Print on Demand".
  - **Produtor**, **Nº do Orçamento**, **Data do orçamento** (usar `cotacao.created_at`, não a data atual), **Tipo de produto**, **Nome do produto**, **Quant. envios mensais médio**.
  - Tabela com apenas duas colunas: **Plano** e **Preço/Envio**.

## Fora do escopo

- Nenhuma mudança de schema: continua usando `frete_cotacoes` já vinculada por `orcamento_id`, e `pod_planos_selecionados` como fonte dos planos.
- Sem alteração no fluxo de envio de e-mail do Financeiro (já usa o `orcamentoGenerator` atualizado).
- Sem alteração na aba Estoque Próprio da UI de Logística.
