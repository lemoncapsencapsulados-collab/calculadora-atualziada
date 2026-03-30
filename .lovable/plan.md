

## Diagnóstico

O erro não está no banco nem no objeto enviado para edição. O problema está no `Calculator.tsx`, no ciclo de `useEffect`:

1. A tela abre com estado inicial `tipoProduto = 'Encapsulados'`
2. O `useEffect([tipoProduto])` roda na montagem e consome `isLoadingFormula.current`
3. Depois, quando a fórmula salva é carregada e faz `setTipoProduto(...)`, o mesmo effect roda de novo
4. Nesse segundo disparo ele aplica os defaults do tipo e sobrescreve os valores reais da fórmula

Por isso um produto salvo com 150g pode abrir como 300g. O mesmo padrão pode afetar Encapsulados, Gummy e Líquido.

Também encontrei um segundo problema: os defaults hardcoded ainda estão desatualizados no mesmo effect:
- Solúvel está `300 / 3` em vez de `300 / 10`
- Gummy está `30 / 1` em vez de `60 / 2`

## Plano de correção

### 1. Corrigir a lógica de carregamento da fórmula
Ajustar o fluxo em `src/pages/Calculator.tsx` para que o carregamento de uma fórmula salva não seja sobrescrito pelo effect de defaults.

Abordagem:
- separar claramente:
  - inicialização padrão de novo produto
  - carregamento de produto existente para edição
- impedir que o effect de defaults rode ao abrir uma fórmula carregada
- garantir que quantidade total e por dose sejam aplicadas exatamente como vieram do produto salvo

### 2. Revisar os defaults por tipo em um único ponto
Padronizar os valores iniciais para novo produto:

- Solúvel: `300g` total / `10g` por dose
- Gummy: `60` total / `2` por dose
- Encapsulados: `60` total / `2` por dose
- Líquido: `30 mL` total / `1 mL` por dose

Isso deve valer apenas para criação nova ou troca manual de tipo, nunca para edição de produto existente.

### 3. Validar o comportamento por tipo
Garantir no fluxo de edição:

- Encapsulados: abrir com a quantidade total de cápsulas e cápsulas por dose salvas
- Solúvel: abrir com quantidade total e dose salvas, respeitando `unidade_soluvel`
- Gummy: abrir com gummies totais e gummies por dose salvos
- Líquido: abrir com mL totais e mL por dose salvos

### 4. Preservar a lógica já existente de embalagens automáticas
Manter a pré-seleção de embalagens por tipo para novo produto, mas evitar que essa automação destrua dados ao editar uma fórmula já criada.

## Arquivo a ajustar

- `src/pages/Calculator.tsx`

## Resultado esperado

Ao clicar em editar um produto criado, a calculadora deve abrir com os mesmos valores salvos no produto:
- quantidade total
- quantidade por dose
- unidade correta

E ao abrir a calculadora para criar um novo produto, os defaults devem ser:
- Solúvel: 300g / 10g
- Gummy: 60 / 2
- Encapsulados: 60 / 2
- Líquido: 30 / 1

