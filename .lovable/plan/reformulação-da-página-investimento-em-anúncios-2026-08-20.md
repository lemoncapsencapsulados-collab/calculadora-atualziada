# Reformulação da página "Investimento em Anúncios"

Reconstrução completa da página com visual próprio (dark neon, só nesta tela), três modos de visualização, painel de IA e integração com a Meta Marketing API.

## 1. Visual e layout

Tema escopado apenas a esta página (wrapper com tokens locais): fundo quase preto, superfícies levemente elevadas, accent teal e violeta, verde para melhora e coral para piora. Cards com borda fina, cantos arredondados, sem sombra pesada. Números grandes, rótulos pequenos. Animação de entrada (fade + slide) e contador animado nos KPIs.

**Header**: título com ícone, status da integração Meta (ponto verde "Conectado · última sync há X" / amarelo "Sem sync há X dias") e botão "Sincronizar agora". Abaixo: filtros de Período (mês atual, mês anterior, trimestre, intervalo custom), Canal, Consultor e menu Exportar (CSV, XLSX, PDF).

**KPIs**: Total investido, Leads, CPL médio, CAC — cada um com variação vs. período anterior (verde/vermelho, lógica invertida em CPL e CAC) e tooltip com a fórmula.

## 2. Três modos de visualização

Toggle com os mesmos dados em três formas:

- **Funil** (padrão): barras Leads → Orçamentos → Vendas com percentual e perda de cada etapa, degradê teal→violeta→coral, e painel lateral com as três taxas de conversão. Clicar numa etapa filtra os consultores abaixo.
- **Consultores**: um card por pessoa (altura natural), barras proporcionais ao maior do grupo, badge de performance, métricas CPL/custo por venda/taxas. Ordenação alternável (vendas, conversão, CPL, investimento). Clicar expande sparkline mensal.
- **Linha do tempo**: gráfico combinado (investimento em linha, leads e vendas em barras) com eixo duplo, tooltip unificado e legenda interativa.

## 3. Tabela de aportes

Lista de registros do período: data, canal, campanha, investimento, leads atribuídos, CPL e ações. Registros vindos da Meta são somente leitura; registros manuais continuam editáveis pelo formulário atual, agora em painel lateral. Linha de total fixa no rodapé.

## 4. Painel de IA

Card no rodapé com análise do período gerada pela IA da Lovable (sem chave sua), usando KPIs, funil e desempenho por consultor como contexto. Regenera ao mudar filtros; exibe "Dados insuficientes para análise" com menos de 10 leads. Botões "Gerar análise completa" (modal) e "Exportar insights".

## 5. Integração Meta Ads

- Botão "Conectar Meta Business" → OAuth com a Meta → token guardado com segurança no backend.
- Nova tabela para os insights diários (data, campanha, gasto, impressões, cliques, leads) e tabela de configuração da conta de anúncios.
- Função de sincronização (manual e diária automática) que busca `insights` da conta de anúncios com granularidade diária, mês atual + anterior.
- Atribuição de leads por consultor via parâmetro `consultor` nas UTMs das campanhas, com ajuste manual pelo gestor quando não houver UTM.
- Se a integração não estiver ativa, o cadastro manual continua funcionando normalmente (fallback).

**Preciso de você**: App ID e App Secret de um app Meta (Business) e o ID da conta de anúncios (`act_...`). Vou pedir esses valores pelo formulário seguro na hora de implementar essa parte.

## 6. Estados e responsividade

Skeletons no carregamento, empty state com ação primária, banner amarelo quando desconectado, toast com retry em erro de sync. Desktop completo; tablet com KPIs 2×2 e cards em coluna; mobile com KPIs + lista de consultores e o resto atrás de "Ver detalhes".

## Detalhes técnicos

- Reescrita de `src/pages/InvestimentoAnuncios.tsx` em componentes menores sob `src/components/anuncios/` (header, KPIs, funil, consultores, timeline, tabela, painel IA).
- Recharts para timeline e sparklines; utilitários de cálculo centralizados em `src/lib/anuncios.ts`.
- Tema local em um wrapper com variáveis CSS próprias, sem alterar o tema global.
- Backend: tabelas `meta_ad_accounts` e `meta_insights` com RLS e grants; funções de OAuth callback, sync e insights de IA; cron diário.
- Exportações CSV/XLSX/PDF reaproveitando a lógica atual, atualizadas para o novo conjunto de dados.
