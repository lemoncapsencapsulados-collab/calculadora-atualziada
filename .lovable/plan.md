## Objetivo

1. **Remover** o botão "Enviado" da listagem de orçamentos — o dropdown de status já cumpre essa função e a duplicação confunde.
2. Permitir registrar **múltiplos contatos** por orçamento (não apenas uma observação única) — cada contato com **data + texto/feedback**.
3. Em **"Insights e Alertas"** (Dashboard), mostrar para cada orçamento enviado um **relatório consolidado**: data do 1º envio, data do 2º envio (se houve reenvio), data do último contato e feedback dessa última conversa. Permite cobrar o time comercial com base em dados reais.

## Mudanças

### 1. Banco de dados (migration)
Adicionar coluna `historico_contatos jsonb default '[]'` em `orcamentos`.

Estrutura de cada item:
```
{ id: uuid, data: ISO timestamp, tipo: 'envio' | 'contato', observacao: string }
```

Manter `data_envio` e `observacoes_internas` para compatibilidade (não removemos), mas a UI passa a usar `historico_contatos` como fonte da verdade. Migração popula um item inicial em `historico_contatos` para orçamentos que já tenham `data_envio` (tipo `envio`) e/ou `observacoes_internas` (tipo `contato`).

### 2. `src/types/orcamento.ts`
Adicionar tipo `ContatoOrcamento` e o campo `historico_contatos?: ContatoOrcamento[]` em `Orcamento`.

### 3. `src/hooks/useOrcamentos.ts`
- Parser inclui `historico_contatos`.
- Nova mutation `addContato({ id, contato })` — faz append no array (lê o atual, dá push, salva).
- Nova mutation `removeContato({ id, contatoId })`.
- `updateStatus`: ao mudar para `enviado`, além de setar `data_envio`, faz append de um item `{ tipo: 'envio', data: agora }` em `historico_contatos` (se não existir envio na mesma data).
- Mantém `updateObservacoesInternas` por compatibilidade, mas a UI nova prioriza `addContato`.

### 4. `src/pages/Orcamentos.tsx`
- **Remover** o botão "Enviado" e seu dialog (`abrirDialogEnviado`, `confirmarEnvio`, `enviandoOrcamento`).
- Substituir o botão "Observação" por **"Histórico de Contatos"**, que abre um diálogo com:
  - Timeline (lista cronológica) dos contatos: ícone (✉️ envio / 💬 contato), data formatada, texto.
  - Formulário para adicionar novo: seletor de data (default hoje), tipo (envio/contato), textarea de feedback.
  - Botão remover por item.
- Continuar mostrando o badge "Enviado: dd/MM/yyyy" no card (lendo do primeiro item `tipo: 'envio'` do histórico).

### 5. `src/types/dashboard.ts`
Estender `InsightDashboard` com:
```
historico?: { primeiro_envio?: string; segundo_envio?: string; ultimo_contato?: string; ultimo_feedback?: string; total_envios: number; total_contatos: number }
```

### 6. `src/hooks/useDashboardComercial.ts`
Refatorar a geração de insights para orçamentos enviados:
- Substituir os blocos atuais (URGENTE / Follow-up / Valor alto / Observação separada) por **um único insight consolidado por orçamento** com:
  - Mensagem: `"<cliente> (<consultor>) — R$ X. 1º envio: dd/MM. 2º envio: dd/MM (ou '—'). Último contato: dd/MM (há N dias)."`
  - `historico` preenchido do array `historico_contatos`.
  - `tipo`: `alerta` se último contato/envio > 14 dias, `atencao` se >= 5, `oportunidade` caso contrário.
- Recusados continuam excluídos.
- Buscar `historico_contatos` no select do hook.

### 7. `src/components/dashboard/DashboardInsights.tsx`
Renderizar bloco extra quando `insight.historico` existir:
- Linha 1: 📤 1º envio — data
- Linha 2: 📤 2º envio — data (ou "Nenhum reenvio")
- Linha 3: 📞 Último contato — data + dias atrás
- Linha 4: 💬 Feedback — texto do `ultimo_feedback`
- Botão "Ver Orçamento" mantido (vai filtrar o card na lista).

## Resultado

- UI de orçamentos mais limpa: apenas o dropdown de status + botão único "Histórico de Contatos".
- Cada orçamento mantém um log cronológico de envios e conversas com feedback.
- Em "Insights e Alertas" cada notificação resume todo o relacionamento com o cliente, permitindo cobrança objetiva do time comercial: "este orçamento foi enviado em X, reenviado em Y, último contato Z dias atrás, feedback foi W".
