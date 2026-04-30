## Objetivo

Dentro da página **Pedidos**, criar subpáginas/abas para a equipe de setup acompanhar separadamente as demandas de cada entregável vendido nos orçamentos:

- **Visão Geral** (página atual)
- **Páginas de Vendas**
- **Designer de Rótulos**
- **Registro no INPI**
- **Impressão de Rótulos**
- **Código de Barras**

Cada subpágina lista somente os pedidos que contrataram aquele entregável, mostrando: **cliente**, **prazo de entrega**, **quantidade contratada**, **consultor**, e **status do entregável** (pendente / em andamento / entregue / não necessário). A Visão Geral ganha um resumo consolidado dessas demandas.

## De onde vêm os entregáveis

Os entregáveis já são gravados no orçamento (e por consequência no `orcamento_snapshot` do pedido) em dois lugares:

1. **`servicos_marca[].entregaveis[]`** (gerados em `GerarOrcamentoDialog`):
   - `Código de barras (Nx)` → categoria **codigo_barras**
   - `Design de rótulos (Nx)` → categoria **design_rotulos**
   - `Página de vendas (Nx)` → categoria **pagina_vendas**
   - `Registro de Marca no INPI (Nx)` → categoria **registro_inpi**
   - `Impressão de rótulos - {tipoProduto} (Nx)` → categoria **impressao_rotulos**
2. **`servicos_marca[].dados_extras.impressao_itens[]`** para detalhar o tipo de produto da impressão.

A categorização por palavra-chave já é determinística (sempre os mesmos rótulos vindos do dialog), então conseguimos extrair sem migração.

## Mudanças propostas

### 1. Novo arquivo `src/lib/entregaveis.ts`
Função utilitária `extrairEntregaveisDoPedido(pedido)` que percorre `orcamento_snapshot.servicos_marca[].entregaveis[]`, classifica cada um em uma das 5 categorias por regex no `nome`, e retorna:

```ts
type EntregavelCategoria = 'pagina_vendas' | 'design_rotulos' | 'registro_inpi' | 'impressao_rotulos' | 'codigo_barras';

interface DemandaEntregavel {
  pedido_id: string;
  numero_pedido: string;
  cliente: string;
  consultor?: string;
  categoria: EntregavelCategoria;
  nome: string;            // rótulo original (ex.: "Página de vendas (2x)")
  detalhe?: string;        // ex.: tipo de produto na impressão
  quantidade: number;
  data_pedido: Date;
  data_pagamento?: Date;
  prazo_previsto: Date;    // calcularPrazoEntrega
  dias_restantes: number;
  status_pedido: StatusPedido;
  status_entregavel: 'pendente' | 'entregue' | 'nao_necessario';
}
```

Mapeamento `categoria → campo do acompanhamento_processos` para inferir `status_entregavel`:
- `pagina_vendas` → `acompanhamento_processos.pagina_venda`
- `design_rotulos` → `acompanhamento_processos.criacao_marca`
- `impressao_rotulos`, `registro_inpi`, `codigo_barras` → não existem hoje no acompanhamento; vamos persistir um novo bloco `acompanhamento_setup` (ver item 3).

### 2. Nova navegação por abas em `Pedidos.tsx`
Adicionar um `Tabs` no topo da página com 6 abas:
`Visão Geral | Páginas de Vendas | Designer de Rótulos | Registro INPI | Impressão de Rótulos | Código de Barras`

- **Visão Geral**: conteúdo atual + um novo card "Demandas de Setup" no topo, com 5 mini-cards (um por categoria) mostrando quantos entregáveis estão pendentes, em produção e atrasados, com link para a aba correspondente.
- **Subpáginas**: novo componente `SubpaginaEntregaveis` que recebe `categoria` e renderiza tabela/cards filtrados, com:
  - busca por cliente / nº pedido
  - filtros por status do entregável e por consultor
  - colunas: Cliente, Consultor, Qtd, Data Pgto, Prazo, Dias restantes (com badge vermelho se atrasado), Status, Ações (mudar status, abrir detalhes do pedido)
  - linhas agrupadas/colapsáveis quando o mesmo pedido tem mais de 1 unidade

### 3. Novo bloco `acompanhamento_setup` no pedido
Como hoje só existem campos para `pagina_venda` e `criacao_marca`, vamos estender `pedidos.acompanhamento_processos` com 3 chaves adicionais via JSONB (sem migração de schema, é jsonb):

```json
{
  "registro_inpi": "pendente|entregue|nao_necessario",
  "impressao_rotulos": "pendente|entregue|nao_necessario",
  "codigo_barras": "pendente|entregue|nao_necessario"
}
```

Defaults via leitura: se a chave não existir, considera `pendente`. Atualização usa o mesmo `updateAcompanhamento` já existente no hook `usePedidos` (merge no JSONB).

A página de detalhes / o componente `AcompanhamentoProcessos.tsx` ganha 3 novas linhas (somente quando o pedido tem aquele entregável contratado).

### 4. Componentes novos
- `src/components/pedidos/DemandasSetupResumo.tsx` — cards-resumo por categoria, exibido no topo da Visão Geral.
- `src/components/pedidos/SubpaginaEntregaveis.tsx` — lista filtrável por categoria.

### 5. Roteamento
Manter `/pedidos` como rota única; abas controladas por estado interno + `?tab=...` em `searchParams` para deep-link (ex.: clicar no card-resumo abre a aba correta).

## Detalhes técnicos

```text
Pedidos.tsx
 ├─ <Tabs value={tab}>
 │   ├─ TabsList: Visão Geral / Páginas / Designer / INPI / Impressão / Código Barras
 │   ├─ TabsContent value="overview"
 │   │   ├─ <DemandasSetupResumo demandas={todasDemandas} onAbrirAba={...}/>
 │   │   └─ (lista de pedidos atual, sem alterações)
 │   └─ TabsContent value="pagina_vendas" ...
 │        └─ <SubpaginaEntregaveis categoria="pagina_vendas" demandas={...}/>
```

Cálculo de prazo reaproveita `calcularPrazoEntrega` já existente (D+30 a partir da data de pagamento ou do pedido).

Status do entregável é resolvido por `useMemo` combinando categoria → campo do `acompanhamento_processos`.

## Não está no escopo

- Migrações de banco (usaremos o JSONB já existente).
- Mexer no fluxo de criação de orçamento (entregáveis já são gravados corretamente).
- Notificações automáticas / atribuição por usuário (pode ser próxima iteração).
