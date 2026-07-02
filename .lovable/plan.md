## Objetivo

Manter a exportação Excel atual da tela **Pedidos** (com detalhamento de itens/produtos por pedido) e **enriquecê-la** com dados completos de pagamento — para servir como base de controle de entradas financeiras por mês e do cálculo de comissões (1% recompra / 5% novo produtor, sobre o **recebido**).

## Escopo

Apenas `src/lib/relatoriosPedidos.ts` — funções `gerarRelatorioPedidoExcel` e `gerarRelatorioPedidosGeralExcel`. Nada muda em UI, CSV, PDF ou regras de comissão. Reaproveita utilitários já existentes:
- `derivarRecebimentos` (`src/lib/recebimentos.ts`) — expande parcelas com valor bruto (com juros), vencimento, status.
- `derivarComissoes` (`src/lib/comissoes.ts`) — expande parcelas com valor líquido, % de comissão (5%/1%), comissão da parcela e flag `pago`.

Ambos já leem `condicoes_pagamento` do snapshot (Pix/Boleto, Cartão parcelado, Misto e Pagamento único), então o "meio de pagamento" que hoje aparece em branco no Excel passa a ser preenchido corretamente.

## Como o workbook fica

O arquivo passa a ter **5 abas**. A primeira é a que já existe hoje, expandida; as outras 4 são novas e derivadas dos mesmos pedidos.

### Aba 1 — `Pedidos` (mantém a atual + colunas de pagamento)
Preserva 100% da estrutura hoje: linha-resumo do pedido + linhas-filhas colapsáveis com produtos (outline), hyperlink "Abrir Pedido", cabeçalho com filtros aplicados, formato BRL, freeze. **Nada é removido.**

Adiciona ao final destas colunas atuais (`Nº Pedido, Cliente, CNPJ, Consultor, Tipo, Modalidade, Produto, Qtd, Preço Unit, Total Produção, Total Setup, Custo Total, Abrir Pedido`) as novas colunas na linha-resumo de cada pedido:
`Método Principal | Nº de Parcelas | Data 1ª Parcela | Data Última Parcela | Data Pagamento (aprovação) | Valor Bruto (com juros) | Valor Líquido (base comissão) | Já Recebido | A Receber | Status Pagamento (Quitado / Parcial / Em aberto)`

As linhas-filhas de produtos ficam vazias nessas novas colunas (mesmo padrão de hoje).

### Aba 2 — `Parcelas` (nova; principal para filtros por mês)
Uma linha por parcela — é aqui que o usuário aplica AutoFilter por mês / consultor / método:
`Nº Pedido | Cliente | CNPJ/CPF | Consultor | Tipo (Novo Produtor/Recompra) | Método | Descrição da Parcela | Parcela nº | Total de Parcelas | Data Vencimento | Mês/Ano Vencimento (YYYY-MM) | Data Pagamento | Mês/Ano Pagamento (YYYY-MM) | Status (Pago/Pendente/Vencido/Sem data) | Valor Bruto | Valor Líquido | % Comissão | Comissão da Parcela | Comissão Devida (só se pago)`

### Aba 3 — `Entradas por Mês` (pivot pronto)
`Mês/Ano | Status Agrupamento (Recebido / Pendente) | Método | Nº Parcelas | Valor Bruto | Valor Líquido`
Recebidos agrupados pelo mês de pagamento; pendentes/vencidos pelo mês de vencimento.

### Aba 4 — `Comissões por Consultor / Mês` (pivot pronto)
`Consultor | Mês/Ano Pagamento | Nº Parcelas Pagas | Valor Líquido Recebido | Comissão Nova Venda (5%) | Comissão Recompra (1%) | Comissão Total`
Considera apenas parcelas com `status = pago`.

### Aba 5 — `Detalhamento por Pedido` (nova; abre 100% do pedido)
Para quem quer ver tudo de um pedido específico sem depender de outra ferramenta. Uma sub-tabela por pedido, empilhadas na mesma aba com separador visual, contendo: cabeçalho do pedido (nº, cliente, CNPJ/CPF, email, telefone, cidade/UF, consultor, tipo, data pedido/pagamento), tabela de Produtos (produto, tipo, modelo, qtd, preço unit, subtotal), tabela de Serviços de Marca, Resumo Financeiro, tabela de Parcelas (descrição, vencimento, valor bruto, valor líquido, status, data pagamento, comissão), Frete, Acompanhamento de Processos e Observações. Mesma informação já disponível no PDF individual, agora em formato de planilha.

## Detalhes técnicos

- Reaproveitar `derivarRecebimentos` + `derivarComissoes`; casar itens por `parcelaIndice` para obter valor bruto (com juros) e valor líquido (base de comissão) no mesmo registro.
- Método principal traduzido para PT: `pix_boleto → "Pix / Boleto"`, `cartao_credito → "Cartão de Crédito"`, `misto → "Misto (Pix/Boleto + Cartão)"`, ausente → "Pagamento único".
- Datas gravadas como valores `Date` nativos do Excel (`t: 'd'`); coluna `Mês/Ano` como texto `YYYY-MM` para AutoFilter.
- `Comissão Devida` = `comissao` quando `pago = true`, senão 0.
- AutoFilter setado (`ws['!autofilter']`) nas abas Pedidos, Parcelas, Entradas por Mês e Comissões — para os filtros nativos do Excel funcionarem sem clique extra.
- `gerarRelatorioPedidoExcel` (um pedido) monta as mesmas 5 abas — só que com um único pedido.

## Fora do escopo

- Nenhuma alteração de UI, CSV, PDF ou regras/percentuais de comissão.
- Sem alteração de schema de banco.
