

# Distribuicao de Orcamentos por Consultor e Status

## Problema Atual
O card "Pipeline por Consultor" exibe apenas orcamentos com status "enviado" em formato de tabela, mostrando dados limitados (valor total, ticket medio, dias aberto). Isso nao fornece uma visao estrategica da performance completa dos consultores.

## Proposta: Grafico de Barras Horizontais Empilhadas

Apos reflexao, o melhor modelo de grafico para esta situacao e o **grafico de barras horizontais empilhadas** (Stacked Horizontal Bar Chart). Justificativa:

- **Comparacao direta entre consultores**: cada barra representa um consultor, facilitando a leitura de quem tem mais orcamentos
- **Distribuicao por status visivel**: os segmentos coloridos dentro de cada barra mostram a proporcao de cada status (Rascunho, Enviado, Aprovado, Recusado)
- **Leitura rapida**: permite identificar em segundos qual consultor converte mais, qual tem mais propostas paradas, qual tem mais recusas
- **Escalabilidade**: funciona bem com 2 a 15+ consultores sem poluir a tela
- **Cores intuitivas**: Rascunho (cinza), Enviado (laranja/amarelo), Aprovado (verde), Recusado (vermelho)

O card tera tambem um resumo em badges no header mostrando o total de orcamentos por status no periodo.

## Alteracoes

### 1. Hook `useDashboardComercial.ts`
- Criar novo `useMemo` chamado `distribuicaoConsultorStatus` que processa `orcamentosFiltrados` (ja respeita filtros de consultor e datas)
- Agrupa por `consultor_responsavel` e conta orcamentos por status: `rascunho`, `enviado`, `aprovado`, `recusado`
- Retorna array com: `{ consultor, rascunho, enviado, aprovado, recusado, total }`
- Exportar no retorno do hook

### 2. Componente `DashboardPipeline.tsx`
- Substituir a tabela atual pelo grafico de barras horizontais empilhadas usando `recharts` (ja instalado)
- Componentes do recharts: `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer` com `layout="vertical"`
- 4 segmentos por barra: Rascunho (cinza), Enviado (amber), Aprovado (verde), Recusado (vermelho)
- Tooltip customizado mostrando quantidade e percentual de cada status
- Legendas coloridas na parte inferior
- Badges no header com totais gerais por status
- Titulo atualizado: "Distribuicao de Orcamentos por Consultor"

### 3. Pagina `DashboardComercial.tsx`
- Passar a nova prop `distribuicaoConsultorStatus` para `DashboardPipeline`

### 4. Tipos `src/types/dashboard.ts`
- Adicionar interface `DistribuicaoConsultorStatus` com campos: `consultor`, `rascunho`, `enviado`, `aprovado`, `recusado`, `total`

## Arquivos Modificados
- `src/types/dashboard.ts` - nova interface
- `src/hooks/useDashboardComercial.ts` - novo useMemo + exportacao
- `src/components/dashboard/DashboardPipeline.tsx` - refatoracao completa do card
- `src/pages/DashboardComercial.tsx` - passar nova prop

