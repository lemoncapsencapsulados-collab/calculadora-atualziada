## Objetivo
Reestruturar o dialog "Novo registro de investimento" e a página de Investimento em Anúncios para trabalhar no modelo **Campanha → Consultores**, com um **Painel Geral** acumulado (baseado no filtro de data da página) exibido acima da tabela "Dados por Campanha".

## Mudanças

### 1. Dialog `RegistroInvestimentoDialog.tsx`
Reorganizar o formulário em duas seções:

**a) Cabeçalho da Campanha**
- Novo campo obrigatório: **Nome da Campanha** (texto livre).
- Manter: Canal de Vendas, Objetivo, Data de início, Data de fim.
- Remover campo "Investimento Total" fixo — o total passa a ser **calculado** pela soma das linhas de consultores da campanha (exibido como readonly).

**b) Bloco "Dados por Campanha" (renomeia "Distribuição por Consultor")**
Tabela editável com linhas dinâmicas. Cada linha:
- Consultor (dropdown com consultores ativos)
- Leads recebidos
- Investimento (R$)
- Botão remover linha
- Botão "+ Adicionar consultor" abaixo da tabela

Rodapé da tabela: Totais da campanha (leads, investimento, CPL da campanha).
Remove-se o alerta de "valor distribuído ultrapassa total" (não faz mais sentido — o total é derivado).

**c) Painel Geral (novo, acima de "Dados por Campanha")**
Card compacto mostrando, **para o período do filtro de data da página** (não da campanha em edição), agregado de TODAS as campanhas salvas + linhas ainda não salvas da campanha atual em edição:
- Linha por consultor: nome, leads acumulados, investimento acumulado, CPL.
- Linha "Total Geral" no final.
- Atualiza em tempo real conforme o usuário digita novas linhas no bloco de campanha.

### 2. Banco de dados
Adicionar coluna `nome_campanha text not null default ''` em `ad_investments` via migração. Campo `investimento_total` continua existindo mas passa a ser recalculado (soma das linhas) no momento do save.

### 3. Página `InvestimentoAnuncios.tsx`
- Adicionar coluna "Campanha" na tabela de Registros de Investimento.
- Passar o período do filtro (mês selecionado) para o dialog, para alimentar o Painel Geral.
- KPIs no topo permanecem (Total Investido, Leads, CPL, CAC) — já são agregados do período.

### 4. Hook `useAdInvestments.ts`
Incluir `nome_campanha` no payload de insert/update e no tipo `AdInvestment` / `AdInvestmentInput`.

## Detalhes técnicos
- Painel Geral: recebe via props os registros já carregados do período + o array `consultores` em edição no dialog. Faz merge in-memory (não requer nova query).
- Validação: exigir pelo menos 1 linha de consultor com investimento > 0 e nome da campanha preenchido para habilitar "Salvar".
- CPL por consultor no Painel Geral = investimento_acumulado / leads_acumulados (0 se leads = 0).

## Fora de escopo
- Campo autocomplete de nome de campanha (fica texto livre).
- Alterações no card "Funil por Consultor" da página e no dialog "Análise do Vendedor" — continuam usando os agregados já existentes.
