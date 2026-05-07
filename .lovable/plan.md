## Objetivo

Reformular o "Exportar Excel" (Geral) da aba Pedidos para gerar uma planilha limpa, com colunas exatamente na ordem solicitada e respeitando os filtros já ativos (data e consultor).

## Onde está hoje

- Arquivo: `src/lib/relatoriosPedidos.ts` (função `gerarRelatorioPedidosGeralExcel` + `buildRows` + `headers`).
- A planilha atual tem 31 colunas (email, telefone, cidade, status de processos, satisfação, etc.) e gera múltiplas linhas por pedido (uma por produto/serviço), o que polui o relatório.
- Os filtros (data início/fim, consultor, status) JÁ são passados de `src/pages/Pedidos.tsx` linhas 745–752, então a filtragem já funciona — o problema é apenas o conteúdo/ordem das colunas.

## Nova estrutura da planilha

Uma linha por **produto** dentro do pedido, agrupando visualmente: nas linhas extras do mesmo pedido, as colunas de cabeçalho do pedido (nº, cliente, consultor, etc.) ficam vazias para manter a hierarquia visual. O setup e o custo total aparecem só na primeira linha do pedido.

Ordem das colunas (exatamente esta):

1. **Nº Pedido**
2. **Cliente (Nome)**
3. **CNPJ do Cliente**
4. **Consultor Responsável**
5. **Tipo** — "Recompra" ou "Novo Produtor"
6. **Modalidade** — "Estoque" ou "Print on Demand" (por produto)
7. **Produto (Nome)**
8. **Quantidade**
9. **Preço Unitário (Pote/Produto)**
10. **Valor Total de Produção** (subtotal do produto = qtd × preço unit.)
11. **Valor Total de Setup (Criação de Marca)** — só na 1ª linha do pedido
12. **Custo Total do Pedido** (soma de produção de todos os produtos + setup) — só na 1ª linha

Linhas de cabeçalho do arquivo:
- Linha 1: "Relatório de Pedidos"
- Linha 2: período do filtro (se houver)
- Linha 3: consultor do filtro (se houver)
- Linha 4: total de pedidos
- Linha 6: cabeçalhos das colunas
- A partir da linha 7: dados

Linha final: TOTAL GERAL (soma de Produção + Setup + Custo Total) considerando todos os pedidos filtrados.

## Regras de cálculo

- **Quantidade / Preço Unit.** vêm de `orcamento_snapshot.itens_producao[i]`:
  - Se `modelo_negocio === 'print_on_demand'` → Quantidade = "POD" (texto), Preço Unit. = `subtotal/quantidade` quando `quantidade > 0`, senão 0.
  - Caso contrário, Quantidade = `item.quantidade`, Preço Unit. = `subtotal / quantidade`.
- **Valor Total de Produção (linha)** = `item.subtotal`.
- **Valor Total de Setup** = `orcamento_snapshot.subtotal_servicos` (consolidado por pedido).
- **Custo Total do Pedido** = `subtotal_producao + subtotal_servicos` (= `valor_total` do snapshot, mantendo arredondamento existente).
- Valores monetários gravados como número (não string), com `cellNF = 'R$ #,##0.00'` para o Excel formatar como BRL.

## Filtros

Continuar usando o array `filteredPedidos` que já vem da página com filtro de data (data de pagamento) e consultor aplicados. Nenhuma mudança em `Pedidos.tsx` necessária — apenas refletir os filtros recebidos no cabeçalho do arquivo (já existe `buildFiltrosLinhas`).

## Arquivos a alterar

- `src/lib/relatoriosPedidos.ts`
  - Novo `headers` reduzido (12 colunas).
  - Novo `buildRows` (consolidado por produto, com setup/custo total só na 1ª linha do pedido).
  - Ajustar `gerarRelatorioPedidosGeralExcel` para adicionar linha de TOTAL GERAL e formatação numérica BRL nas colunas monetárias.
  - `gerarRelatorioPedidoExcel` (export individual) também passa a usar a mesma estrutura para consistência.

Nada muda no PDF nem no CSV.

## Não escopo

- Não mexer em filtros da página, layout da tela, nem no PDF.
- Não adicionar colunas extras (email, telefone, status, satisfação) — ficam fora deste relatório.