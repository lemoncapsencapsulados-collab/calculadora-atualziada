

## Plano: Enriquecer "Exportar Geral" de Pedidos com todos os detalhes + filtros aplicados

### Problema
O export atual (PDF e Excel) tem apenas dados básicos: produto, qtd, valor unit., subtotal, serviço, pagamento, observações. Faltam: consultor, CNPJ, tipo de produto, modelo de compra, subtotais separados (Setup/Produção), data de pagamento, frete e o filtro de datas usado.

### Alterações

**1. `src/lib/relatoriosPedidos.ts`** — reescrever `extractData`, `headers`, `buildRows` e `addPedidoToPDF`

Novo `extractData` extrai do `orcamento_snapshot`:
- `consultor`, `nomeCliente`, `cnpj`, `email`, `telefone`, `cidadeEstado`
- `subtotalSetup` (subtotal_servicos), `subtotalProducao` (subtotal_producao), `valorTotal`
- `dataPagamento`, `tipoOrcamento` (Recompra/Novo Produtor)
- Para cada item: `nomeProduto`, `tipoProduto` (Encapsulado/Solúvel/Líquido/Gummy — derivado de `formula_snapshot` ou item), `modeloCompra` (Estoque/POD), `quantidade`, `precoUnitario`, `subtotal`
- `condicoesPagamento` (formatadas em string)
- `frete` (tipo de envio + descrição + frete Lemon Caps)

**Novos headers Excel** (uma linha por item de produto, com dados do pedido replicados na primeira linha):
```
Nº Pedido | Data Pedido | Data Pagamento | Consultor | Cliente | CNPJ | Email | Telefone | Cidade/Estado | Tipo Orçamento | Produto | Tipo Produto | Modelo Compra | Quantidade | Preço Unit. | Subtotal Produto | Serviço Marca | Valor Serviço | Orç. Setup | Orç. Produção | Orç. Total | Forma Pagamento | Frete | Observações
```

**Novo PDF**: `addPedidoToPDF` ganha bloco "Dados do Cliente" (consultor, CNPJ, telefone, cidade), tabela de produtos com colunas extras (Tipo Produto, Modelo), bloco "Resumo Financeiro" (Setup / Produção / Total), seção de Frete e linha "Data de Pagamento".

**2. Filtro aplicado nos exports** — `gerarRelatorioPedidosGeralPDF` e `...Excel` recebem um segundo parâmetro opcional `filtros: { dataInicio?: Date; dataFim?: Date; consultor?: string; status?: string }`:
- PDF: cabeçalho mostra "Período: dd/MM/yyyy a dd/MM/yyyy", "Consultor: X", "Status: Y" quando aplicáveis.
- Excel: nome do arquivo vira `Relatorio_Pedidos_2026-01-01_a_2026-04-20.xlsx`; primeira linha do sheet exibe os filtros antes dos headers.

**3. `src/pages/Pedidos.tsx`** — chamar exports passando os filtros:
```ts
gerarRelatorioPedidosGeralPDF(filteredPedidos, {
  dataInicio: dataInicioFiltro, dataFim: dataFimFiltro,
  consultor: filtroConsultor !== 'todos' ? filtroConsultor : undefined,
  status: filterStatus !== 'todos' ? filterStatus : undefined,
});
```
Idem para o Excel.

### Detecção do "Tipo de Produto"
Prioridade:
1. `item.formula_snapshot?.tipo_produto` ou `item.tipo_produto` (do snapshot do orçamento)
2. `pedido.formula_snapshot?.tipo_produto` (fallback para pedidos antigos)
3. `'-'` se ausente

Mapeamento para label legível: `encapsulado` → "Encapsulado", `soluvel` → "Solúvel", `liquido_gotas` → "Líquido (Gotas)", `liquido_spray` → "Líquido (Spray)", `gummy` → "Gummy".

### Arquivos modificados
- `src/lib/relatoriosPedidos.ts`
- `src/pages/Pedidos.tsx`

