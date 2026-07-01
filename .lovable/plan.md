## Alterações no popup "Resumo para Contrato" (Orçamentos)

### 1. Renomear para "Projeto para Contrato"
Substituir todos os rótulos visíveis do fluxo:
- `src/components/PropostaCompletaDialog.tsx`: `DialogTitle` (linha 1289), `DialogTitle` do preview (1185), botão "Gerar Resumo para Contrato" (1723) e mensagem introdutória (1294).
- `src/pages/Orcamentos.tsx`: botão "Resumo para Contrato" (506) e "Ver Resumo do Contrato" (510).
- `src/components/OrcamentoKanbanView.tsx`: tooltips (161 e 170).
Mantém as chaves internas / nomes de tabela (`resumos_contrato`, `useResumoContrato`) — só muda texto de UI.

### 2. CNPJ obrigatório + auto-preenchimento
Em `PropostaCompletaDialog.tsx` (bloco "1. Informações do Cliente", `tipoPessoa === 'pj'`):
- Marcar o label "CNPJ" com `*` vermelho.
- Adicionar validação em `handleGenerateProposta`: se PJ e CNPJ vazio/ inválido → `toast.error` e abortar antes de gravar.
- Auto-fill já existe (useEffect que chama BrasilAPI quando `cnpj` tem 14 dígitos, linha ~692). Vou reforçar mostrando um indicador visual "Buscando dados do CNPJ..." enquanto `isSearchingCnpj` estiver ativo, para dar feedback ao usuário conforme digita.

### 3. Detalhamento de Frete simplificado
Reescrever o Card "4. Detalhamento de Frete" (linhas 1611–1685) para conter **apenas** um `RadioGroup` com duas opções:
- `total_produtor` → "Envio Total dos Potes para o Produtor (CNPJ)"
- `total_lemoncaps` → "Envios da Lemon Caps para o cliente final (CPF)"

Remover:
- Opção "Envio Parcial" e o textarea `descricao_parcial`.
- Pergunta "Frete via Lemon Caps para cliente final?" e os botões Sim/Não (`freteLemonCaps`).
- Pergunta "Usar tabela tradicional de envio?" e alternativas (`usaTabelaTradicional`).

Ajustes de estado/persistência:
- Remover os useStates `freteLemonCaps` e `usaTabelaTradicional` (e restauração deles em `useEffect`).
- Ao montar `DetalhamentoFrete` para salvar (em `handleGenerateProposta` e `handleDownload`), fixar `frete_lemon_caps` como `detalhamentoEnvio.tipo === 'total_lemoncaps'` e `usa_tabela_tradicional = false`, preservando compatibilidade com o schema existente.
- `descricao_parcial` sempre `''`.

### 4. Condições de Pagamento — detalhamento no envio
As condições (método, número de parcelas e vencimentos) já são gravadas em `orcamento.condicoes_pagamento` e renderizadas no PDF via `renderCondicoesPagamento` (`src/lib/orcamentoGenerator.ts` linha 831). Vou:
- Confirmar que o PDF do "Projeto para Contrato" (gerado por `generateOrcamentoPDFBlob`) já lista método + cada parcela + vencimento. Se algum campo não estiver aparecendo, ajustar `renderCondicoesPagamento` para incluir explicitamente: forma de pagamento, quantidade de parcelas, valor de cada parcela e data de vencimento correspondente.
- Nenhuma mudança em backend/webhook — o snapshot já leva `condicoes_pagamento` completo para Pedidos e ZapSign.

### Fora de escopo
- Nada de mudanças em edge functions, tabelas ou fluxo de aprovação/pago.
- Chaves internas (`total_produtor`, `total_lemoncaps`, `frete_lemon_caps`, `usa_tabela_tradicional`) permanecem para não quebrar registros antigos.
