## Objetivo

Três ajustes na área de Logística/Frete:

1. Download em lote (ZIP) de todas as cotações exibidas na lista.
2. Atalho "Ver Frete" na seção "4. Detalhamento de Frete" da Proposta para Contrato.
3. Reestruturar o popup "Ver produtos" em Logística para discriminar preço por plano.

---

### 1. Download em lote (.zip) de cotações

**Onde:** `src/pages/Logistica.tsx` (topo da lista, ao lado de "Nova Cotação") e dentro do popup "Ver produtos" (baixar apenas do produtor atual).

**Como:**
- Adicionar `jszip` como dependência.
- Novo helper `src/lib/freteZipExport.ts` com função `exportCotacoesAsZip(cotacoes, orcamentosMap)`:
  - Para cada cotação, renderizar `CotacaoExportCard` off-screen via ReactDOM.createRoot num container temporário, gerar PNG com `renderElementToPngBlob` (já existente em `src/lib/freteImageExport.ts`) e adicionar ao ZIP com nome `frete_<numeroOrc>_<produto>.png`.
  - Baixar o `.zip` final via link temporário.
- Botão "Baixar todas (ZIP)" com ícone `Archive`/`FileDown`, com indicador de progresso (toast atualizando "Gerando X/Y...").
- Escopo do botão principal: respeita o filtro de aba atual (POD ou Estoque Próprio).
- Escopo do botão no popup de produtor: apenas as cotações daquele produtor.

### 2. Atalho "Ver Frete" na Proposta para Contrato

**Onde:** `src/components/PropostaCompletaDialog.tsx`, dentro do Card "4. Detalhamento de Frete" (linhas ~2106-2143).

**Como:**
- Importar `FreteOrcamentoDialog` e `fetchFreteCotacoesByOrcamento`.
- Adicionar estado local `freteDialogAberto` e um botão "Ver Cotações de Frete Vinculadas" no header do card (só aparece se houver cotações vinculadas ao `orcamento.id`).
- Abrir o mesmo `FreteOrcamentoDialog` já usado em `src/pages/Orcamentos.tsx`, passando `orcamentoId`, `produtor` (dadosCliente.nome_completo) e `numeroOrcamento`.
- Nenhuma mudança de lógica de negócio — apenas atalho de visualização.

### 3. Popup "Ver produtos" discriminando preço por plano

**Onde:** `src/pages/Logistica.tsx`, linhas 354-422 (Dialog `produtorAberto`).

**Estrutura atual:** tabela plana com uma linha por cotação, coluna "Planos" mostra lista de números e "Preço/envio" mostra "a partir de X".

**Nova estrutura:** substituir por cards por produto, cada card contendo:
- Cabeçalho: nome do produto + tipo + nº do orçamento + data + Quant. Envios Mensais médio + ações (Editar/Baixar PNG/Excluir).
- Sub-tabela expandida com todos os planos selecionados:

```text
Plano (frascos) | Preço / Envio
    30          |   R$ 24,50
    60          |   R$ 38,90
   120          |   R$ 62,10
```

- Para Estoque Próprio: mostra o valor único e o status.
- Reaproveita `pod_planos_selecionados` já existente e o helper `formatBRL`.
- Botão "Baixar todas (ZIP) deste produtor" no rodapé do popup (item 1).

---

### Detalhes técnicos

- Nenhuma alteração de schema no banco.
- `jszip` já é leve e compatível com Vite; será importado dinamicamente para não pesar no bundle inicial.
- Geração PNG em lote: renderizar sequencialmente para evitar problemas de layout paralelo com html2canvas; toast de progresso atualiza a cada item.
- O botão de atalho na Proposta reusa exatamente o componente `FreteOrcamentoDialog` — sem duplicação de UI.

### Arquivos afetados

- `src/pages/Logistica.tsx` — botão ZIP + reestruturação do popup "Ver produtos".
- `src/components/PropostaCompletaDialog.tsx` — botão "Ver Frete" no card 4.
- `src/lib/freteZipExport.ts` — novo helper de geração ZIP.
- `package.json` — adicionar `jszip`.
