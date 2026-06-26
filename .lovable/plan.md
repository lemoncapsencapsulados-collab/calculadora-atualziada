## Mudança solicitada

Aplicar regras de cobrança da etapa **Estabilidade + Anvisa** por item:

| Tipo do item | Teste de Estabilidade (R$ 4.100) | Notificação Anvisa (R$ 1.750) |
|---|---|---|
| Fórmula personalizada (não-catálogo) | **Cobra** | **Cobra** |
| Fórmula do Catálogo Lemon | **Isento** | **Cobra** |
| Revenda Lemon (perfil do Passo 3) | **Isento** (etapa pulada) | **Isento** (etapa pulada) |

O perfil Revenda Lemon já pula a etapa — sem mudanças.

---

## Arquivos alterados

### `src/components/GerarOrcamentoDialog.tsx`
- Criar helper `itemEhCatalogo(item)` reutilizando `isCatalogo()` + `precificacoes` (mesma lógica do `todosItensSaoCatalogo`).
- Derivar dois subconjuntos:
  - `itensEstabilidade` = `itensProducao.filter(it => !itemEhCatalogo(it))`
  - `itensAnvisa` = `itensProducao` inteiro (quando não-Revenda)
- Substituir o cálculo único:
  ```ts
  const totalEstabilidadeAnvisa =
    custoEstabilidadeUnit * itensEstabilidade.length +
    custoAnvisaUnit * itensAnvisa.length;
  ```
- Em `buildServicosMarca`:
  - Linha **Teste de Estabilidade**: usar `qtdEstab = itensEstabilidade.length`; só cria entrada se `qtdEstab > 0`. Descrição passa a citar "N produto(s) personalizado(s)".
  - Linha **Notificação Anvisa**: usar `qtdAnvisa = itensAnvisa.length`.
- Passar ambos os subconjuntos (ou contagens) ao `EstabilidadeAnvisaStep` via novas props.

### `src/components/orcamento/EstabilidadeAnvisaStep.tsx`
- Aceitar novas props: `itensEstabilidade: ItemProducao[]` e `itensAnvisa: ItemProducao[]` (mantém `itensProducao` para a listagem geral).
- Na lista "Itens contabilizados", marcar cada item com badge:
  - **"Catálogo — isento de estabilidade"** (verde) para itens de catálogo
  - **"Personalizada"** para os demais
- Bloco "Teste de estabilidade": rótulo passa a "(por produto personalizado)"; contador usa `itensEstabilidade.length`; se 0, mostrar aviso "Todos os itens são do Catálogo — sem custo de estabilidade" e desabilitar input.
- Bloco "Notificação Anvisa": continua usando `itensAnvisa.length`.
- Recalcular `totalEstab`, `totalAnvisa`, `total` com as contagens corretas.

### Sem alteração
- `src/lib/orcamentoGenerator.ts` / `src/components/DetalhesPedidoDialog.tsx`: já renderizam as linhas vindas de `servicos_marca` e omitem automaticamente a linha de Estabilidade quando ausente.
- Backend, migrações, perfil Revenda Lemon, senha `0212`, prazos (10 dias úteis + 6 meses).

---

## Notas
- Restauração de orçamentos antigos: o cálculo passa a refletir as novas regras assim que o usuário re-entrar no Passo 4; entradas antigas salvas continuam sendo lidas (não há mudança de schema).
- Caso `itensEstabilidade.length === 0` **e** `itensAnvisa.length === 0` (cenário só possível sem produtos), o subtotal fica 0 e nada é injetado, como hoje.
