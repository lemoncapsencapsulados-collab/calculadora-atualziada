

## Plano: Relatório de Pedidos em PDF e Excel (individual e geral)

### Objetivo
Adicionar dois botões de exportação na página de Pedidos:
1. **Relatório individual** — botão dentro de cada card de pedido
2. **Relatório geral** — botão no topo da página, exporta todos os pedidos filtrados

Ambos disponíveis em PDF e Excel, contendo: Nome do cliente, Consultor responsável, Produtos e quantidades, Setup de criação de marca e valor do serviço.

### Alterações

**1. Novo arquivo: `src/lib/relatoriosPedidos.ts`**

Funções de geração:

- `gerarRelatorioPedidoPDF(pedido)` — PDF individual com jsPDF + autoTable
- `gerarRelatorioPedidosGeralPDF(pedidos)` — PDF consolidado de todos os pedidos filtrados
- `gerarRelatorioPedidoExcel(pedido)` — Excel individual com xlsx (SheetJS)
- `gerarRelatorioPedidosGeralExcel(pedidos)` — Excel consolidado

Dados extraídos do `orcamento_snapshot` de cada pedido:
- `nome_cliente` → Nome do cliente
- `consultor_responsavel` → Consultor
- `itens_producao[]` → nome_produto + quantidade + subtotal
- `servicos_marca[]` → nome_plano + valor (setup de criação de marca/rótulo)

Estrutura do PDF:
- Cabeçalho com título e data de geração
- Seção por pedido (no geral) ou seção única (no individual)
- Tabela de produtos: Nome | Quantidade | Valor Unitário | Subtotal
- Tabela de serviços de marca: Serviço | Valor
- Totais

Estrutura do Excel:
- Aba "Pedidos" com colunas: Nº Pedido | Cliente | Consultor | Produto | Qtd | Valor Unit. | Subtotal Produto | Serviço Marca | Valor Serviço
- Uma linha por produto, com dados do pedido repetidos (formato tabular para filtros)

**2. Instalar dependência: `xlsx` (SheetJS)**

Para geração de arquivos `.xlsx` no navegador.

**3. Arquivo: `src/pages/Pedidos.tsx`**

- Adicionar no topo da página (ao lado da barra de busca) dois botões: "Exportar PDF" e "Exportar Excel" para relatório geral dos pedidos filtrados
- Dentro de cada card de pedido, adicionar um dropdown ou botões "Relatório PDF" e "Relatório Excel" para exportação individual
- Importar e chamar as funções do novo módulo

### Detalhes técnicos
- jsPDF já está instalado no projeto (usado em `pdfGenerator.ts`)
- SheetJS (`xlsx`) será adicionado como dependência
- Os dados vêm do `orcamento_snapshot` já carregado em memória, sem queries adicionais

