## Objetivo

Mostrar, no topo do **Painel Administrador**, um contador visível com os **dias restantes** até a aplicação automática do Prazo de Preços (janela de 20 dias após salvar variáveis estruturais).

## O que será exibido

Logo abaixo do cabeçalho "Painel Administrador" (acima das abas), um card destacado contendo:

- **Número grande de dias restantes** (ex: `12 dias`)
- **Data de início** e **data de vencimento** do prazo (formato dd/mm/aaaa)
- **Barra de progresso** mostrando quanto da janela de 20 dias já passou
- **Cor dinâmica**:
  - Verde: > 10 dias restantes
  - Amarelo: 4–10 dias
  - Vermelho: ≤ 3 dias
- **Mensagem contextual**: "Os preços de orçamentos não aprovados serão recalculados automaticamente em DD/MM/AAAA."
- Quando **não há prazo ativo**: card neutro com "Nenhum Prazo de Preços ativo. As próximas alterações iniciarão uma nova janela de 20 dias."
- Quando há **múltiplos prazos ativos**: mostra o mais próximo de vencer e indica quantidade adicional ("+2 outros prazos ativos").

## Arquivos

**Criar:**
- `src/components/admin/PrazoPrecoCountdown.tsx` — card de contagem regressiva, usa `usePrazosAtivos()` e `calcDiasRestantes()` já existentes em `src/hooks/usePrazoPrecoAtivo.ts`. Atualiza sozinho a cada minuto via `refetchInterval` do hook.

**Editar:**
- `src/pages/PainelAdministrador.tsx` — renderizar `<PrazoPrecoCountdown />` entre o cabeçalho e as `<Tabs>`.

## Notas técnicas

- Reaproveita 100% da infraestrutura existente (`prazo_precos`, `usePrazosAtivos`, `calcDiasRestantes`). Sem nova migração.
- Sem alteração de lógica de negócio — apenas visualização.
- Componente acessível somente após desbloqueio do painel (já garantido pelo `AdminPasswordGate`).
