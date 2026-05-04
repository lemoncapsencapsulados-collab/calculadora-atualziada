## Objetivo

Trocar o seletor de calendário da **Data do Pagamento** por inputs numéricos editáveis (dia, mês, ano), iguais ao que já existe em "Histórico de Contatos". Hoje a data só pode ser escolhida clicando no calendário — você precisa poder digitar diretamente DD, MM e AAAA.

## Onde a data de pagamento aparece hoje

Após mapear o código, a data de pagamento é **editada em um único lugar**:

- **Popup de Aprovação** (`AprovacaoOrcamentoDialog`) — abre quando você muda o status do orçamento para "Pago". É o mesmo dialog usado pela tela de Orçamentos e pela Proposta. Hoje usa um `Popover + Calendar` (linhas 1019-1039).

Nos outros lugares (lista de orçamentos, pedidos, detalhes) a data só é exibida (read-only), não editada — então não precisa mexer.

## Mudanças

### 1. `src/components/AprovacaoOrcamentoDialog.tsx`

**Substituir** o bloco do `Popover + CalendarComponent` (linhas 1019-1039) por três inputs numéricos no formato **DD / MM / AAAA**, seguindo exatamente o mesmo padrão do `DateNumericInput` já usado em `Orcamentos.tsx`:

- **Dia**: aceita até 2 dígitos (01-31), com validação por mês
- **Mês**: aceita até 2 dígitos (01-12)
- **Ano**: aceita no mínimo 4 dígitos (ex.: 2026)
- Digitação livre, sem auto-pular entre campos
- Ao sair do campo (blur), aplica zero-padding (ex.: "5" → "05") se o valor for válido
- Bloqueia datas futuras (mantém a regra atual `date > new Date()` → exibe erro inline em vermelho)

**Estado:** trocar `dataPagamento: Date | undefined` por três strings (`diaPg`, `mesPg`, `anoPg`) + um `Date` derivado via `buildDate()`. Inicializar a partir de `orcamento.data_pagamento` (se já existir) ou vazio.

**Validação no botão Confirmar:** continuar exigindo data válida e não-futura antes de salvar (`data_pagamento: date.toISOString()` nas linhas 534 e 543).

### 2. Componente compartilhado (refactor leve)

Para não duplicar o `DateNumericInput`, **extrair** o componente de `src/pages/Orcamentos.tsx` para um arquivo novo:

- `src/components/ui/date-numeric-input.tsx` — exporta `DateNumericInput`, `buildDate`, `lastDayOfMonth`

Atualizar os imports em:
- `src/pages/Orcamentos.tsx` (remover definição local, importar do novo arquivo)
- `src/components/AprovacaoOrcamentoDialog.tsx` (importar e usar)

## Resumo visual

```text
ANTES:                          DEPOIS:
[ 📅 04/05/2026 ▾ ]            [ DD ] / [ MM ] / [ AAAA ]
   (abre calendário)              (digita direto, ex: 04 / 05 / 2026)
```

## Arquivos afetados

- `src/components/ui/date-numeric-input.tsx` (novo)
- `src/components/AprovacaoOrcamentoDialog.tsx` (substituir Popover+Calendar)
- `src/pages/Orcamentos.tsx` (importar do novo arquivo em vez de definir localmente)

Sem mudanças no banco de dados, sem mudanças de outros fluxos.