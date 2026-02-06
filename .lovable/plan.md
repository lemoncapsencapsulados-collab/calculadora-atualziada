

## Plano: Dashboard Comercial Completa por Consultor

### Objetivo

Criar uma **subpagina analitica e estrategica** totalmente integrada ao sistema existente, com foco em permitir visao 360 graus de cada consultor: vendas realizadas, pipeline de negociacao, recorrencia e oportunidades.

---

### Analise do Sistema Atual

| Aspecto | Estado Atual |
|---------|--------------|
| Tabela Principal | `orcamentos` - contem todos os dados necessarios |
| Status Disponiveis | `rascunho`, `enviado`, `aprovado`, `recusado` |
| Consultores Cadastrados | 6+ consultores ativos (TON, KILSON, DANIELLE, DERECK, JOAO, EVERTON) |
| Dados Existentes | 8 orcamentos (3 aprovados, 5 em outras fases) |
| Faturamento Total Aprovado | R$ 48.866,60 |
| Produtos por Orcamento | Armazenados como JSONB em `itens_producao` |
| Servicos por Orcamento | Armazenados como JSONB em `servicos_marca` |

---

### Mapeamento de Status

Para a dashboard, os status serao agrupados em tres camadas:

```text
APROVADO → Vendas Fechadas (resultado real)
ENVIADO → Pipeline / Em Negociacao
RASCUNHO → Rascunho (pode incluir em pipeline ou ignorar)
RECUSADO → Perdidas (para taxa de conversao)
```

---

### Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Navigation.tsx                        │    │
│  │  + Novo Link: "Dashboard Comercial" (/dashboard)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              DashboardComercial.tsx (NOVA)              │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │            useDashboardComercial.ts             │    │    │
│  │  │  (Hook que processa dados de orcamentos)        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                         │    │
│  │  Componentes Internos:                                  │    │
│  │  ├── DashboardKPIs.tsx                                  │    │
│  │  ├── DashboardVendasAprovadas.tsx                       │    │
│  │  ├── DashboardPipeline.tsx                              │    │
│  │  ├── DashboardRecorrencia.tsx                           │    │
│  │  ├── DashboardPerfil.tsx                                │    │
│  │  └── DashboardInsights.tsx                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

### BLOCO 1: KPIs Gerais (Topo da Pagina)

Cards destacados no topo mostrando metricas globais:

| KPI | Descricao | Fonte |
|-----|-----------|-------|
| Faturamento Total | Soma de valor_total onde status = aprovado | orcamentos |
| Novas Vendas | Contagem de orcamentos aprovados | orcamentos |
| Pipeline em Negociacao | Soma de valor_total onde status = enviado | orcamentos |
| Ticket Medio Geral | Faturamento / Novas Vendas | calculado |
| Taxa de Conversao | Aprovados / (Aprovados + Recusados) | calculado |

---

### BLOCO 2: Vendas Aprovadas (Resultado Real)

#### Metricas por Consultor

```text
┌────────────────────────────────────────────────────────────────────┐
│ RANKING DE CONSULTORES - VENDAS FECHADAS                          │
├──────────────────────┬─────────┬──────────────┬─────────┬─────────┤
│ Consultor            │ Vendas  │ Faturamento  │ Ticket  │ Clientes│
├──────────────────────┼─────────┼──────────────┼─────────┼─────────┤
│ TON                  │ 2       │ R$ 41.268,00 │ R$ 20K  │ 2       │
│ DERECK               │ 1       │ R$ 7.598,60  │ R$ 7K   │ 1       │
├──────────────────────┼─────────┼──────────────┼─────────┼─────────┤
│ TOTAL                │ 3       │ R$ 48.866,60 │         │ 3       │
└──────────────────────┴─────────┴──────────────┴─────────┴─────────┘
```

#### Mix de Vendas (Analise Automatica)

Para cada consultor, calcular:

- Total de produtos de producao vendidos (itens_producao)
- Total de servicos de marca vendidos (servicos_marca)
- Proporcao producao vs servicos
- Alertas de dependencia de produto unico

#### Produtos Mais Vendidos

```text
┌───────────────────────────────────────────────────────────────────┐
│ PRODUTOS MAIS VENDIDOS                                            │
├──────────────────────────────┬─────────┬──────────────┬──────────┤
│ Produto                      │ Qtd     │ Faturamento  │ % Total  │
├──────────────────────────────┼─────────┼──────────────┼──────────┤
│ SEM FITOTERAPICO            │ 500     │ R$ 9.500,00  │ 19.4%    │
│ VITAMINA B12                │ 500     │ R$ 8.000,00  │ 16.4%    │
│ Melatonina + triptofanos    │ 200     │ R$ 4.000,00  │ 8.2%     │
└──────────────────────────────┴─────────┴──────────────┴──────────┘
```

---

### BLOCO 3: Pipeline de Negociacao

#### Metricas de Pipeline por Consultor

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PIPELINE POR CONSULTOR                                              │
├──────────────────────┬─────────┬──────────────┬──────────┬─────────┤
│ Consultor            │ Propostas│ Valor Total │ Ticket   │ Dias Med│
├──────────────────────┼─────────┼──────────────┼─────────┼─────────┤
│ EVERTON BARROS       │ 1       │ R$ 50.080   │ R$ 50K  │ 2 dias  │
│ KILSON SILVA         │ 2       │ R$ 18.720   │ R$ 9K   │ 5 dias  │
│ DANIELLE             │ 1       │ R$ 10.400   │ R$ 10K  │ 3 dias  │
│ JOAO Ferrari         │ 1       │ R$ 32.268   │ R$ 32K  │ 7 dias  │
├──────────────────────┼─────────┼──────────────┼─────────┼─────────┤
│ TOTAL PIPELINE       │ 5       │ R$111.468   │         │         │
└──────────────────────┴─────────┴──────────────┴─────────┴─────────┘
```

#### Alertas de Pipeline

- Propostas paradas ha mais de 7 dias
- Pipeline alto com baixa conversao
- Propostas de maior valor em aberto

---

### BLOCO 4: Vendas Recorrentes (Recompras)

#### Nova Tabela no Banco de Dados

Criar tabela `recompras` para armazenar vendas recorrentes:

```sql
CREATE TABLE recompras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente TEXT NOT NULL,
  consultor_responsavel TEXT NOT NULL,
  data_recompra TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  produtos JSONB NOT NULL DEFAULT '[]',
  quantidade_total INTEGER NOT NULL,
  valor_total NUMERIC NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Interface de Cadastro Manual

Dialog para inserir recompras com campos:
- Nome do cliente (autocomplete de clientes existentes)
- Consultor responsavel
- Data da recompra
- Produtos e quantidades
- Valor total
- Observacao

#### Metricas de Recorrencia

| Metrica | Descricao |
|---------|-----------|
| Total Recompras | Soma de valor_total de recompras |
| % Faturamento Recorrente | Recompras / (Vendas + Recompras) |
| Clientes Recorrentes | Contagem distinta de clientes |
| Ticket Medio Recompra | Total / Quantidade |
| Produto Mais Recomprado | Ranking por frequencia |

---

### BLOCO 5: Analise Temporal

#### Filtros de Periodo

```text
┌──────────────────────────────────────────────────────────────┐
│ PERIODO: [Mensal ▼] [Janeiro 2026 ▼] até [Fevereiro 2026 ▼] │
└──────────────────────────────────────────────────────────────┘
```

Opcoes:
- Mensal
- Bimestral
- Trimestral
- Semestral
- Customizado

#### Graficos Temporais

- Evolucao de faturamento (linha)
- Comparativo novas vendas vs recorrencia (barras empilhadas)
- Pipeline ao longo do tempo (area)

---

### BLOCO 6: Perfil dos Clientes

Baseado nos dados de `dados_cliente` do orcamento:

#### Metricas de Perfil

| Campo | Descricao |
|-------|-----------|
| Canal de Venda | locais_fisicos, venda_digital, ambas |
| Distribuicao Geografica | cidade, estado |
| Tipo de Documento | CPF vs CNPJ |

#### Analise por Canal

```text
┌──────────────────────────────────────────────────────────────┐
│ DISTRIBUICAO POR CANAL DE VENDA                             │
├──────────────────────┬─────────┬──────────────┬─────────────┤
│ Canal                │ Clientes│ Faturamento  │ Ticket Med  │
├──────────────────────┼─────────┼──────────────┼─────────────┤
│ Digital              │ 2       │ R$ 25.000    │ R$ 12.500   │
│ Fisico               │ 1       │ R$ 15.000    │ R$ 15.000   │
│ Ambos                │ 1       │ R$ 8.866     │ R$ 8.866    │
└──────────────────────┴─────────┴──────────────┴─────────────┘
```

---

### BLOCO 7: Insights Automaticos

Sistema de geracao de insights baseado em regras:

#### Tipos de Insights

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 🔴 ALERTA: TON tem R$ 32K em pipeline ha mais de 7 dias            │
├─────────────────────────────────────────────────────────────────────┤
│ 🟡 ATENCAO: KILSON tem ticket medio 30% abaixo da media            │
├─────────────────────────────────────────────────────────────────────┤
│ 🟢 POSITIVO: EVERTON tem a maior proposta do mes (R$ 50K)          │
├─────────────────────────────────────────────────────────────────────┤
│ 📊 OPORTUNIDADE: 70% das vendas sao de producao, poucos servicos   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Regras de Geracao

- Pipeline parado > 7 dias
- Ticket medio < 80% da media geral
- Baixa recorrencia (<10% do faturamento)
- Alta concentracao em um produto (>50%)
- Pipeline alto sem fechamento recente

---

### Arquivos a Criar/Modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/pages/DashboardComercial.tsx` | Criar | Pagina principal da dashboard |
| `src/hooks/useDashboardComercial.ts` | Criar | Hook para processamento de dados |
| `src/hooks/useRecompras.ts` | Criar | Hook para gerenciar recompras |
| `src/components/dashboard/DashboardKPIs.tsx` | Criar | Componente de KPIs |
| `src/components/dashboard/DashboardVendas.tsx` | Criar | Componente de vendas |
| `src/components/dashboard/DashboardPipeline.tsx` | Criar | Componente de pipeline |
| `src/components/dashboard/DashboardRecorrencia.tsx` | Criar | Componente de recorrencia |
| `src/components/dashboard/DashboardInsights.tsx` | Criar | Componente de insights |
| `src/components/dashboard/DashboardFiltros.tsx` | Criar | Componente de filtros |
| `src/components/dashboard/NovaRecompraDialog.tsx` | Criar | Dialog para inserir recompra |
| `src/types/dashboard.ts` | Criar | Tipos TypeScript |
| `src/components/Navigation.tsx` | Modificar | Adicionar link da dashboard |
| `src/App.tsx` | Modificar | Adicionar rota /dashboard |
| Migracao SQL | Criar | Tabela recompras |

---

### Migracao do Banco de Dados

```sql
-- Tabela de recompras (vendas recorrentes)
CREATE TABLE recompras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente TEXT NOT NULL,
  consultor_responsavel TEXT NOT NULL,
  data_recompra TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  produtos JSONB NOT NULL DEFAULT '[]',
  quantidade_total INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE recompras ENABLE ROW LEVEL SECURITY;

-- Politicas RLS (permissivas para workspace compartilhado)
CREATE POLICY "Permitir leitura publica de recompras"
  ON recompras FOR SELECT USING (true);

CREATE POLICY "Permitir insercao publica de recompras"
  ON recompras FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualizacao publica de recompras"
  ON recompras FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusao publica de recompras"
  ON recompras FOR DELETE USING (true);
```

---

### Tecnologias e Bibliotecas

| Biblioteca | Uso |
|------------|-----|
| Recharts | Graficos (ja instalado) |
| date-fns | Manipulacao de datas (ja instalado) |
| Lucide React | Icones (ja instalado) |
| shadcn/ui | Componentes UI (ja instalado) |

---

### Layout Visual da Dashboard

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD COMERCIAL                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ FILTROS: [Consultor ▼] [Periodo ▼] [Jan 2026] até [Fev 2026]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ FATUR.  │ │ VENDAS  │ │PIPELINE │ │ TICKET  │ │CONVERSAO│       │
│  │R$48.866 │ │   3     │ │R$111.468│ │ R$16.288│ │  100%   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                                     │
│  ┌────────────────────────────┐ ┌────────────────────────────┐     │
│  │ RANKING CONSULTORES        │ │ EVOLUCAO TEMPORAL          │     │
│  │ ┌────┬──────┬───────┐      │ │      📈 Grafico           │     │
│  │ │TON │ 2    │ R$41K │      │ │                            │     │
│  │ │DER │ 1    │ R$7K  │      │ │                            │     │
│  │ └────┴──────┴───────┘      │ │                            │     │
│  └────────────────────────────┘ └────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────┐ ┌────────────────────────────┐     │
│  │ PIPELINE                   │ │ PRODUTOS MAIS VENDIDOS     │     │
│  │ ┌────┬──────┬───────┐      │ │ ┌─────────────┬─────┐      │     │
│  │ │EVE │ 1    │ R$50K │      │ │ │ NAC         │ 200 │      │     │
│  │ │KIL │ 2    │ R$18K │      │ │ │ B12         │ 500 │      │     │
│  │ └────┴──────┴───────┘      │ │ └─────────────┴─────┘      │     │
│  └────────────────────────────┘ └────────────────────────────┘     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ INSIGHTS E ALERTAS                                           │  │
│  │ 🔴 Pipeline parado: JOAO - R$ 32K ha 7 dias                  │  │
│  │ 🟢 Maior venda do mes: EVERTON - R$ 50K                      │  │
│  │ 📊 Mix desbalanceado: 80% producao, 20% servicos             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Funcionalidades Detalhadas

#### 1. Hook useDashboardComercial

```typescript
// Principais funcoes do hook:
- getVendasAprovadas(filtros)
- getPipeline(filtros)
- getMetricasPorConsultor(filtros)
- getProdutosMaisVendidos(filtros)
- getMixVendas(consultorId)
- getInsightsAutomaticos()
- getEvolucaoTemporal(periodo)
```

#### 2. Calculo de Metricas

```typescript
// Exemplo de calculo de mix
function calcularMixVendas(orcamentos: Orcamento[]) {
  const totalProducao = orcamentos.reduce(
    (acc, o) => acc + o.subtotal_producao, 0
  );
  const totalServicos = orcamentos.reduce(
    (acc, o) => acc + o.subtotal_servicos, 0
  );
  const total = totalProducao + totalServicos;
  
  return {
    producao: { valor: totalProducao, percentual: (totalProducao/total)*100 },
    servicos: { valor: totalServicos, percentual: (totalServicos/total)*100 },
    equilibrado: Math.abs((totalProducao/total) - 0.5) < 0.2
  };
}
```

#### 3. Sistema de Insights

```typescript
// Regras de geracao de insights
const regras = [
  { 
    tipo: 'alerta',
    condicao: (pipeline) => pipeline.diasParado > 7,
    mensagem: (c) => `${c.consultor} tem R$ ${c.valor} parado ha ${c.dias} dias`
  },
  {
    tipo: 'positivo',
    condicao: (venda) => venda.valor > mediaGeral * 1.5,
    mensagem: (v) => `${v.consultor} fechou venda acima da media: R$ ${v.valor}`
  }
];
```

---

### Resultado Esperado

1. **Visao 360 graus** de cada consultor
2. **Separacao clara** entre resultado real (aprovado) e potencial (pipeline)
3. **Recorrencia rastreavel** com cadastro manual
4. **Insights automaticos** para tomada de decisao
5. **Graficos executivos** para apresentacao gerencial
6. **Totalmente integrado** ao modulo de Orcamentos existente
7. **Visual limpo e profissional** seguindo o padrao do sistema

