## Objetivo

No diálogo "Histórico de contatos" da tela de Orçamentos:

1. Trocar o calendário por **três campos numéricos** (Dia, Mês, Ano) que se autocorrigem enquanto o usuário digita.
2. Garantir que ao **adicionar ou remover** um contato a timeline atualize **imediatamente** sem precisar fechar e reabrir.

## 1. Inputs numéricos de data

Substituir o `Popover + CalendarPicker` (linhas 599‑617 de `src/pages/Orcamentos.tsx`) por três `<Input type="text" inputMode="numeric">` lado a lado:

```
[ DD ] / [ MM ] / [ AAAA ]
```

Comportamento:

- Cada campo aceita só dígitos; outros caracteres são descartados ao digitar.
- **Dia (DD)**: 1–31. Se o usuário digitar `4`, fica `4`; ao sair do campo (`onBlur`) vira `04`. Valores >31 são travados em `31`; >3 no primeiro dígito pula automaticamente para o campo Mês.
- **Mês (MM)**: 1–12. Mesma lógica de zero‑padding no blur; >12 trava em `12`; primeiro dígito >1 pula para o campo Ano.
- **Ano (AAAA)**: 4 dígitos. Quando completar 4 dígitos, valida; se < 2000 ajusta para 2000, se > 2100 ajusta para 2100.
- Após cada alteração válida em qualquer campo, recalcula o `Date` e atualiza `novoContatoData`.
- Se a data resultante for inválida (ex.: 31/02/2026), o dia é ajustado automaticamente para o último dia válido do mês selecionado.
- Estado interno separado para os 3 strings (`dia`, `mes`, `ano`) para preservar o que o usuário está digitando; o `Date` é derivado.
- Inicializa com a data atual no formato correto ao abrir o diálogo (já chamado em `abrirHistorico`).

Estilo: usar o componente `Input` existente (`src/components/ui/input.tsx`), com `className="text-center"` e larguras `w-12 / w-12 / w-20`. Separadores `/` em texto entre eles. Manter o `Label` "Data".

## 2. Atualização imediata da timeline

A timeline lê de `historicoOrcamento.historico_contatos`. Hoje:

- **Adicionar** (linhas 148‑167): já tenta atualizar via `allOrcamentos.find(...)`, mas o `find` roda **antes** do React Query terminar de revalidar (`invalidateAll()` é chamado depois), então frequentemente devolve a versão antiga e a UI parece não atualizar.
- **Remover** (linhas 169‑173): nem tenta atualizar o `historicoOrcamento` local — só invalida queries; por isso o item sumido só aparece após reabrir.

Correção: aplicar uma **atualização otimista local** no próprio `historicoOrcamento` antes/depois da mutação:

- **Adicionar**: após `await addContato.mutateAsync(...)`, montar o novo `ContatoOrcamento` (com o `id` retornado pela mutação ou `crypto.randomUUID()` se a mutação não devolver) e chamar `setHistoricoOrcamento(prev => prev ? { ...prev, historico_contatos: [...(prev.historico_contatos || []), novo] } : prev)`. Manter o `invalidateAll()` para sincronizar com o servidor.
- **Remover**: antes/depois de `removeContato.mutateAsync(...)`, chamar `setHistoricoOrcamento(prev => prev ? { ...prev, historico_contatos: (prev.historico_contatos || []).filter(c => c.id !== contatoId) } : prev)`.

Adicionalmente, sincronizar o `historicoOrcamento` quando a lista de orçamentos for revalidada: um `useEffect` que observa `[orcamentos, kanbanOrcamentos, historicoOrcamento?.id]` e, se encontrar uma versão mais nova (compare `updated_at`), atualiza o estado local. Isso garante consistência mesmo se outro evento mudar o orçamento.

## 3. Detalhes técnicos

Arquivos alterados:

- `src/pages/Orcamentos.tsx`
  - Novo subcomponente local `DateNumericInput` (ou inline) com os 3 inputs e as regras de validação descritas.
  - Remover imports não usados (`Popover`, `PopoverContent`, `PopoverTrigger`, `CalendarPicker`, `CalendarIcon`) se nenhum outro trecho deste arquivo os usar — verificar antes de remover.
  - Adicionar o `useEffect` de sincronização e ajustar `adicionarContato` / `removerContato` para atualização otimista.

Sem mudanças em banco de dados, hooks ou outros componentes.

## Fora do escopo

- Edição de contatos já registrados (apenas adicionar/remover, como hoje).
- Mudanças nos Insights do Dashboard.
