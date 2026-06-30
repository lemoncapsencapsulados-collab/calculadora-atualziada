## Objetivo

Adicionar no Dashboard Comercial um botão **"Análise Apurada do Vendedor"** que abre um modal de seleção de vendedor e gera um relatório mensal completo com métricas de vendas, potes por tipo, setups, conversão e funil — com opção de baixar em PDF.

## Fluxo

1. No `Dashboard Comercial` → novo botão **"Análise Apurada do Vendedor"** no topo.
2. Clique → abre **PopUp 1**: lista de vendedores (vem da tabela `usuarios`, cargo "Consultor"/ativos).
3. Selecionar vendedor → abre **PopUp 2** (tela cheia / dialog grande) com:
   - Seletor de **mês/ano** (default: mês atual).
   - Cards de métricas + tabelas.
   - Botão **"Baixar PDF"** no topo.

## Métricas calculadas (por vendedor + mês)

Base: `orcamentos` filtrados por `consultor_responsavel = vendedor.nome` no mês escolhido.
- **Vendas** = orçamentos com status "Pago" ou que viraram pedido (`pedido_id_gerado IS NOT NULL`), ou status liquidado pelo VHSys.
- **Orçamentos gerados** = todos do mês (qualquer status).
- **Em negociação** = status em ("rascunho", "enviado", "em_negociacao") — soma de `valor_total`.

### Bloco 1 — Vendas
- Quantidade de vendas no mês.
- Lista de produtos vendidos (agregado por `nome_produto` com qtd potes e receita).
- **Total de potes vendidos** (somando todos os `itens_producao[].quantidade` das vendas, independente de tipo).
- **Potes por tipo**: Encapsulado, Líquido, Solúvel, Gummy (agrupa por `segmento` do item).
- **Maior volume de potes em uma única venda** (max `sum(quantidade)` por orçamento).

### Bloco 2 — Setups
- Lista de setups vendidos (extraídos de `servicos_marca[]` onde `tipo = 'plano'` ou nome do plano nas vendas).
- **Setup mais vendido** (moda).
- **Valor médio de setup vendido**.
- **Maior valor de plano de setup vendido**.

### Bloco 3 — Funil
- Orçamentos gerados no mês.
- Vendas realizadas no mês.
- **Taxa de conversão** = vendas / orçamentos gerados.
- **Valor em negociação** (R$).

### Bloco 4 — Resumo financeiro
- Receita total das vendas (`sum(valor_total)`).
- Ticket médio.

## PDF

Gerar com `jsPDF + jspdf-autotable` (já usados em `MonetizzeConsultaCard`):
- Cabeçalho: "Análise Apurada — [Nome do Vendedor] — [Mês/Ano]".
- Seções espelhando os 4 blocos acima (cards convertidos em tabelas).
- Rodapé com data de geração.

## Detalhes técnicos

- Toda a lógica vive no frontend (sem migration nem edge function).
- Query única: `supabase.from('orcamentos').select('*').gte('created_at', inicioMes).lt('created_at', proxMes).eq('consultor_responsavel', nome)`.
- Considerar "venda" quando `status IN ('Pago','Convertido') OR pedido_id_gerado IS NOT NULL OR vhsys_liquidado_em IS NOT NULL`.
- Tipo de produto vem de `item.segmento` (valores existentes: Encapsulado, Líquido, Solúvel, Gummy).
- Potes vêm de `item.quantidade`.
- Setups: percorrer `servicos_marca` procurando entradas com `tipo='plano'` ou `categoria='setup'`; fallback para itens com nome contendo "setup"/"plano".

## Arquivos

- **Novo**: `src/components/dashboard/AnaliseVendedorDialog.tsx` — modal completo (seleção vendedor + relatório + PDF).
- **Editar**: `src/pages/DashboardComercial.tsx` — botão e integração do modal.
- **Novo**: `src/lib/analiseVendedor.ts` — funções puras de agregação (vendas, potes por tipo, setups, conversão) — facilita teste e mantém o componente enxuto.

## Fora do escopo

- Não cria novas tabelas nem migrations.
- Não altera fluxo de orçamento/pedido existente.
- Não adiciona filtros adicionais além de vendedor + mês.
