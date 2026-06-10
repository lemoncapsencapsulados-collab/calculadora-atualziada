## Objetivo

Substituir a grade de cards em `/pedidos` por uma lista tabular focada em 4 colunas: **Razão Social**, **Data de Pagamento**, **Valor Faturado** e **Detalhes**. Status, prazo e ações secundárias passam para o popup de Detalhes ou um menu compacto na linha.

## Mudanças

### 1. Visual: cards → lista

Em `src/pages/Pedidos.tsx`, no bloco que hoje renderiza `<div className="grid ... md:grid-cols-2 xl:grid-cols-3"> filteredPedidos.map(...)`, trocar pela tabela:

| Coluna | Conteúdo |
|---|---|
| Razão Social | Texto principal grande/negrito (substitui o "clienteName" atual). Abaixo, em cinza pequeno, o `numero_pedido`. |
| Data de Pagamento | `orcamento_snapshot.data_pagamento` formatado `dd/MM/yyyy`. Para pedidos antigos (formula_snapshot) ou sem data, mostrar "—". |
| Valor Faturado | `getPedidoValorEfetivo(snap)` (ou `valor_total` quando não houver snapshot) com `formatBRL`. |
| Detalhes | Botão "Ver Detalhes" + menu `⋮` (DropdownMenu) com as demais ações. |

Mobile: a tabela vira lista vertical (`md:table`/`block` ou `<Card>` por linha em telas pequenas) preservando a mesma ordem de colunas como pares label/valor.

### 2. Razão Social — origem e fallback

Novo helper local `getRazaoSocialOuNome(pedido)` que escolhe na ordem:

1. `orcamento_snapshot.dados_cliente.razao_social`
2. Cadastro de cliente vinculado (via `cliente_id` ou nome em `clientesById`/`clientesByNome`) — campo `razao_social`
3. Fallback: nome completo do cliente (`dados_cliente.nome_completo || nome_cliente || formula_snapshot.cliente`)

Sem rótulo "PF" — fallback silencioso para nome completo.

### 3. Menu ⋮ por linha

Substitui os múltiplos botões inline. Itens (mesmos handlers de hoje, condicionados como já estão):

- Ficha Técnica (isOrcamento)
- Baixar Ordem (não-orçamento)
- Relatório → PDF / Excel (isOrcamento)
- Copiar Relatório WhatsApp (isOrcamento)
- Abrir WhatsApp (com mesmo `buildWhatsappUrl` + tooltip de telefone indisponível)
- Recompra (isOrcamento)
- Alterar pagamento (isOrcamento)
- Editar observações
- Excluir (destrutivo, separador acima)

Acompanhamento de Processos sai da linha e vira uma seção dentro do popup de Detalhes.

### 4. Popup "Ver Detalhes"

Continua usando `DetalhesPedidoDialog` (botão já chama `setPedidoDetalhe`). Acréscimos no dialog:

- Cabeçalho mostra Razão Social em destaque + nome do responsável logo abaixo.
- Bloco "Status do pedido": badge de status + faixa de prazo (mesmo cálculo `calcularPrazoEntrega` e cores que hoje aparecem no card).
- Seção "Produção" listando cada fórmula/produto com quantidade (a partir de `orcamento_snapshot.formulas`/`formula_snapshot`).
- Seção "Setup" listando cada entregável (registro INPI, impressão de rótulos, código de barras, etc.) com quantidade, derivado de `todasDemandas.filter(d => d.pedido_id === pedido.id)` agrupado por `categoria` (mesma fonte usada hoje em `setupCategorias`).
- Seção "Acompanhamento de Processos" reaproveitando o componente `<AcompanhamentoProcessos>` já usado no card, com o mesmo `onUpdate`.
- Manter os blocos já existentes do dialog (pagamento, endereço, condições, observações).

### 5. Ordenação e filtros

Mantém o `filteredPedidos`/`searchTerm`/`filterStatus` atuais. Adicionar ordenação clicável por **Data de Pagamento** (desc por padrão) e **Valor Faturado** via cabeçalhos da tabela.

## Fora de escopo

- Não muda schema, snapshots, edge functions, comissões ou regras de pagamento.
- Não altera o card de "Resumo" no topo da página.
- Não toca em PDF/Excel ou no `GerarOrcamentoDialog`.

## Detalhes técnicos

- Arquivos: `src/pages/Pedidos.tsx` (refator do bloco de listagem) e `src/components/DetalhesPedidoDialog.tsx` (adicionar seções Status/Produção/Setup/Acompanhamento).
- Reuso: `getPedidoValorEfetivo`, `formatBRL`, `calcularPrazoEntrega`, `getStatusConfig`, `AcompanhamentoProcessos`, `DropdownMenu` shadcn.
- Tabela: shadcn `Table` para desktop; em `<md` renderizar cada pedido como um bloco com as 4 linhas label/valor, preservando o botão Detalhes e o menu ⋮.
- Nenhuma migração SQL.
