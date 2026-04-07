

## Plano: Ocultar custos e margem do PDF do orçamento

### O que muda
A descrição do serviço de Setup salva em `servicos_marca` atualmente contém `"Custo: R$ X | Margem: Y%"`, que aparece na coluna "Descrição" da tabela de serviços no PDF. Isso precisa ser removido para que o cliente não veja custos internos nem margem de lucro.

### Detalhes técnicos

**Arquivo:** `src/components/GerarOrcamentoDialog.tsx`

1. Alterar a linha ~235 onde `descricao` é montada:
   - **Atual:** `descricao: \`Custo: ${formatCurrency(custoTotalSetup)} | Margem: ${margemSetup}%\``
   - **Novo:** `descricao: 'Serviços de setup para início da produção'` (ou descrição genérica similar, sem mencionar custo, margem ou valores internos)

2. Manter `setup_detalhes` intacto internamente (custos e margem continuam salvos para uso interno no sistema, apenas não aparecem no PDF).

Apenas uma linha precisa ser alterada. O PDF já não renderiza `setup_detalhes` — o único vazamento é via o campo `descricao`.

