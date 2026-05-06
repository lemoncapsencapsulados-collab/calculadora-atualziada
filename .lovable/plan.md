# Produtos e Observação no "Sucesso do Cliente"

## Objetivo
Permitir que o time de Sucesso do Cliente cadastre, em cada pedido da aba **Sucesso do Cliente**:
1. **Nome(s) de produto(s)** — um ou mais nomes comerciais do produto associado ao pedido (ex.: "Whey Lemon", "Colágeno Bem-Estar").
2. **Observação geral do CS** — campo livre de texto para anotações da equipe de Sucesso do Cliente sobre o pedido como um todo (separado das observações por etapa que já existem).

Esses dados ficam visíveis no card e no detalhe do projeto, e podem ser editados a qualquer momento.

## Onde os dados ficam salvos
Sem nova migração. Aproveitamos o `jsonb` `acompanhamento_processos` (tabela `pedidos`) já usado pelo Sucesso do Cliente, adicionando dois campos opcionais:

- `produtos_cs?: { id: string; nome: string }[]`
- `observacao_geral_cs?: string`

Atualização em `src/types/formula.ts` (interface `AcompanhamentoProcessos`).

## UI — Detalhe do projeto (`ProjetoDetalheDialog.tsx`)
Adicionar um bloco novo **"Produtos e Observações do CS"** logo abaixo do header e acima da lista de etapas:

```text
┌─ Produtos e Observações do CS ──────────────┐
│ Produtos do pedido                          │
│  • [Whey Lemon         ] [×]                │
│  • [Colágeno Bem-Estar ] [×]                │
│  [+ Adicionar produto]                      │
│                                             │
│ Observação geral do CS                      │
│  ┌─────────────────────────────────────────┐│
│  │ (textarea — anotações livres)           ││
│  └─────────────────────────────────────────┘│
│                              [Salvar]       │
└─────────────────────────────────────────────┘
```

- Lista editável de produtos (input + botão remover, botão "Adicionar produto").
- Salvar dispara `onUpdate(pedido.id, novoAcomp)` mesclando os campos com o `acompanhamento_processos` atual.
- O resumo copiado (`copiarResumoCS`) passa a incluir os produtos e a observação geral, quando presentes.

## UI — Card resumo (`ProjetoCard.tsx`)
- Mostrar os nomes de produtos como chips/badges abaixo do nome do cliente (ex.: `Whey Lemon · Colágeno Bem-Estar`).
- Se houver `observacao_geral_cs`, mostrar ícone de nota com tooltip do texto (truncado).

## Helpers em `src/lib/sucessoCliente.ts`
Duas funções utilitárias para manter o padrão dos demais `aplicar*`:

- `aplicarProdutosCS(acomp, produtos)`
- `aplicarObservacaoGeralCS(acomp, texto)`

## Filtros (opcional, leve)
No `SucessoCliente.tsx`, o campo de busca passa a considerar também `produtos_cs[].nome`, para que a CS encontre projetos pelo nome comercial do produto.

## Arquivos
**Editados:**
- `src/types/formula.ts` — novos campos opcionais.
- `src/lib/sucessoCliente.ts` — `aplicarProdutosCS`, `aplicarObservacaoGeralCS`.
- `src/components/sucesso-cliente/ProjetoDetalheDialog.tsx` — novo bloco de produtos + observação geral; resumo copiado atualizado.
- `src/components/sucesso-cliente/ProjetoCard.tsx` — exibição de produtos e indicador de observação.
- `src/pages/SucessoCliente.tsx` — busca também por nome de produto.

**Sem migração de banco** (usa o `jsonb` existente).
