## Objetivo

Eliminar do PDF (e da Proposta) a linha **"Custo: R$ X | Margem: Y%"** que aparece na coluna Descrição da seção "Serviços de Marca". Esse texto expõe nosso custo interno e margem e jamais pode ser visto pelo cliente.

## Causa

Em `src/components/GerarOrcamentoDialog.tsx:457`, no fluxo **Produtor Experiente**, a `descricao` do serviço de Setup é montada como:

```ts
`Custo: ${formatCurrency(custoTotalSetupLegacy)} | Margem: ${margemSetup}%`
```

Esse valor é salvo no orçamento e renderizado pelo PDF e pela Proposta na coluna Descrição.

## Mudanças

### 1. `src/components/GerarOrcamentoDialog.tsx` (linha ~457)
Substituir a descrição que expõe custo/margem por um texto neutro voltado ao cliente, por exemplo `'Setup personalizado'` (ou string vazia, ficando `-` no PDF). Sem `Custo:` nem `Margem:` em nenhuma hipótese. Cálculos internos e o `setup_detalhes` (que guarda custo/margem internamente para uso administrativo) ficam intactos — só muda o texto exibido ao cliente.

### 2. `src/lib/orcamentoGenerator.ts` — função `renderServicos`
Adicionar saneamento defensivo ao montar `servicosData`: antes de imprimir `servico.descricao`, remover qualquer trecho que case com `/Custo:\s*R?\$?[^|]*\|\s*Margem:\s*[\d.,]+%?/i` (e também trechos soltos com `Custo:` ou `Margem:`). Isso protege PDFs gerados de **orçamentos antigos já salvos** com a descrição contaminada, sem precisar migrar dados.

### 3. `src/lib/propostaGenerator.ts`
Aplicar o mesmo saneamento defensivo na seção equivalente que renderiza a descrição dos serviços de marca.

## O que NÃO muda

- Cálculo de preço, margem, validações de margem mínima, senha de override, `setup_detalhes`, valor cobrado, subtotal e total — tudo intacto.
- Estrutura visual do PDF (tabela Serviço/Descrição/Valor, entregáveis, SUBTOTAL SERVIÇOS) continua igual; só a coluna Descrição passa a mostrar texto neutro.
- Telas internas (`Detalhes do Pedido`, dialogs administrativos) seguem podendo mostrar custo/margem para uso interno — a mudança é exclusiva dos artefatos enviados ao cliente (PDF de Orçamento e Proposta Completa).
- Nada no banco é migrado — orçamentos antigos com a descrição contaminada ficam protegidos pelo saneamento no gerador.

## Arquivos afetados

- `src/components/GerarOrcamentoDialog.tsx`
- `src/lib/orcamentoGenerator.ts`
- `src/lib/propostaGenerator.ts`
