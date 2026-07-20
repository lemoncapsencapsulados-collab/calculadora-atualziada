## Melhorias no dialog "Nova Cotação de Frete" — modo Print on Demand

Escopo focado apenas no dialog `FreteCotacaoDialog` em `src/pages/Logistica.tsx`. Aplica-se somente quando o modelo selecionado é **Print on Demand** — o fluxo de Estoque Próprio fica inalterado.

### 1. Seletor de orçamento com busca + filtro por consultor

Substituir o `<Select>` atual de "Orçamento vinculado" (POD) por um combobox pesquisável:

- Campo de busca livre (por número do orçamento ou nome do cliente).
- Filtro adicional "Consultor" (dropdown alimentado por `useConsultoresDisponiveis()` de `src/hooks/useOrcamentosPaginados.ts`, ou por `useUsuarios(true)` para manter consistência com o resto do sistema — decidir na implementação pelo padrão já usado em Orçamentos).
- Lista rolável mostrando `ORC-XXX — Nome do cliente — Consultor`.
- Usar componentes shadcn `Command` / `Popover` (padrão já usado em `ConsultorCombobox.tsx` e `ClienteSelector.tsx`).

### 2. Auto-preenchimento dos produtos do orçamento

Ao selecionar um orçamento no modo POD:

- Ler `itens_producao` do orçamento (já disponível via `useOrcamentos`).
- Remover o `<Select>` manual de "Tipo de Produto".
- Renderizar uma **lista de linhas, uma por item de produção**, cada linha contendo:
  - Nome do produto (`nome_produto`) — apenas leitura.
  - Tipo de produto: pré-preenchido a partir de `item.tipo_produto` (mapeando os valores existentes para `Encapsulado | Líquido | Gummy | Solúvel`; quando não houver, deixar `Select` para o usuário escolher).
  - Plano (nº de frascos): `Select` com `FRETE_POD_PLANOS`.
  - Preço por envio: auto-preenchido via `fetchPodPrecoAtivo(tipo, plano)` sempre que tipo+plano forem definidos; badge "manual" e destaque âmbar se editado; aviso quando não houver preço tabelado.
  - Quantidade estimada de envios (opcional) + total estimado calculado.
- Ao clicar em "Criar Cotação", criar **uma cotação POD por linha preenchida** (múltiplas linhas em `frete_cotacoes`, todas vinculadas ao mesmo `orcamento_id`). A checagem de substituição via `fetchFreteCotacaoByOrcamento` roda uma única vez antes do batch; se o usuário confirmar substituir, todas as cotações POD ativas anteriores desse orçamento viram `ativa=false` antes do insert em lote.

### 3. Simplificação visual do dialog no modo POD

Confirmar que no modo POD **não aparecem** os campos: Nome do Produtor, Nome do Produto/Segmento, Quantidade, Valor do Frete Médio e Status. (Hoje já estão condicionados a `tipo === 'estoque_proprio'`; ajuste apenas garantir que nada apareça acidentalmente e revisar labels/estrutura ao introduzir a lista de itens.)

### 4. Tabela POD em Logística

Sem mudanças no schema. A tabela POD já suporta múltiplas linhas por orçamento — cada produto vira uma linha independente na listagem existente.

### Detalhes técnicos

- Nenhum arquivo além de `src/pages/Logistica.tsx` precisa ser alterado.
- Nenhuma migration nova (schema atual já comporta N cotações POD por orçamento).
- Hooks reutilizados: `useOrcamentos`, `useConsultoresDisponiveis` (ou `useUsuarios(true)`), `fetchPodPrecoAtivo`, `useCreateFreteCotacao` (chamado em loop com `substituir=true` só na primeira chamada quando aplicável).
- Componentes shadcn: `Command`, `Popover`, `ScrollArea`, `Badge`.
