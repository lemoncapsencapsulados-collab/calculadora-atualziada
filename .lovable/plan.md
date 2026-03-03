

# Busca de Precificacoes no Seletor do Passo 2

## Problema
O seletor "Selecionar Precificacoes" (Passo 2 de 4) lista todas as precificacoes sem nenhum campo de busca/filtro, dificultando encontrar itens quando ha muitas precificacoes salvas.

## Solucao
Adicionar um campo de busca (Input) no topo do card de selecao que filtra as precificacoes em tempo real por nome da formula ou nome do cliente.

## Alteracoes

### `src/components/GerarOrcamentoDialog.tsx`

1. Novo estado `buscaPrecificacao` (string, default '')
2. No bloco `precificacoesDisponiveis` (linha ~288), aplicar filtro adicional: se `buscaPrecificacao` nao estiver vazio, filtrar por `formulas.nome_formula` ou `formulas.cliente` contendo o termo (case-insensitive)
3. Dentro do card `showPrecificacaoSelector` (linha ~406), adicionar um `<Input>` com placeholder "Buscar por formula ou cliente..." logo apos o header, antes da listagem
4. Resetar `buscaPrecificacao` ao fechar o seletor

Nenhum arquivo novo necessario. Alteracao isolada em um unico arquivo.

