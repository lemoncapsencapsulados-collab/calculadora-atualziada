# Painel Administrador

Nova aba **sigilosa** acessível por senha (`Lemon1235@`), que centraliza todas as variáveis estruturais que formam o preço na Calculadora/Precificação. Edições salvas atualizam **automaticamente** os custos dos novos orçamentos gerados após a alteração, e cada salvamento gera um **snapshot completo** no histórico.

## O que o usuário verá

**1. Acesso protegido**
- Novo item no menu: **"Painel Administrador"** (ícone de cadeado, exibido apenas após desbloqueio na sessão).
- Ao entrar pela primeira vez na sessão: tela com campo de senha. Senha correta (`Lemon1235@`) → libera o painel até logout/refresh.

**2. Aba "Variáveis Estruturais"** — formulário editável dividido em blocos:

- **Folhas de pagamento mensais (R$)**
  - Folha da Produção (alimenta "Mão de Obra Direta")
  - Folha Administrativa / restante (alimenta "Despesas Administrativas")

- **Capacidade mensal de produção** (unidades/mês), 4 campos editáveis:
  - Cápsula / Encapsulados
  - Solúvel
  - Gummy
  - Líquido

- **Custos diretos editáveis** (valor por unidade, R$):
  - Energia Elétrica
  - Depreciação de Máquinas

- **Taxa de Perca (%)** — substitui a margem de segurança fixa de 20% e é aplicada sobre o custo total de produção.

**3. Cálculo automático visível em tempo real**

Para cada tipo de produto, mostra um cartão com:
```
Mão de Obra Direta  = Folha Produção  ÷ Capacidade do tipo
Despesas Admin.     = Folha Admin.    ÷ Capacidade do tipo
```
Ex.: Folha Produção R$ 50.000 ÷ 20.000 cápsulas/mês = **R$ 2,50/un**.

**4. Botão "Salvar e aplicar"**
- Valida campos, grava na configuração ativa e cria um registro de histórico (snapshot completo).
- Toast confirma: "Custos atualizados — novos orçamentos usarão estes valores".

**5. Aba "Histórico de Alterações"**
- Tabela ordenada por data (mais recente primeiro): data/hora, usuário, e para cada variável os valores **anterior → novo** com a variação (R$ e %).
- Botão "Ver detalhes" abre snapshot completo daquela versão.
- Botão "Comparar com atual" mostra diff lado a lado.

## Como funciona na precificação

Hoje, ao abrir a Precificação de um produto, o sistema lê `configuracao_custos` (ativa) e usa `mao_obra_direta`, `energia_eletrica`, `depreciacao_maquinas`, `despesas_administrativas` como custos por unidade.

Mudanças:
- Ao salvar no Painel Admin, esses 4 campos da `configuracao_custos` ativa são **recalculados** com base em folhas + capacidade do tipo de produto correspondente. Como agora variam por tipo, novos orçamentos passam a buscar o valor pelo `tipo_produto` da fórmula.
- A "margem de segurança fixa de 20%" no `precificacaoCalculator.ts` passa a usar o campo **taxa_perca** vindo da configuração.
- Orçamentos já existentes **não mudam** (continuam com seus valores salvos). Apenas novos cálculos refletem a edição.

## Detalhes técnicos

**Banco de dados (migrações):**

1. `configuracao_custos` — adicionar colunas:
   - `taxa_perca numeric default 20` (substitui o 20% hardcoded)
   - `folha_producao numeric default 0`
   - `folha_administrativa numeric default 0`
   - `capacidade_encapsulados numeric default 0`
   - `capacidade_soluvel numeric default 0`
   - `capacidade_gummy numeric default 0`
   - `capacidade_liquido numeric default 0`
   - `mao_obra_direta_por_tipo jsonb default '{}'` (cache calculado: `{encapsulados, soluvel, gummy, liquido}`)
   - `despesas_admin_por_tipo jsonb default '{}'`

2. Nova tabela `historico_configuracao_custos`:
   - `id uuid pk`
   - `configuracao_id uuid` (referência lógica)
   - `usuario_email text`
   - `snapshot jsonb` (toda a configuração no momento)
   - `snapshot_anterior jsonb` (para diff rápido)
   - `created_at timestamptz default now()`
   - RLS: select/insert para `authenticated`.

**Frontend:**

- `src/pages/PainelAdministrador.tsx` (nova rota `/painel-administrador`).
- `src/components/admin/AdminPasswordGate.tsx` — gate de senha (estado em `sessionStorage`, chave `admin_panel_unlocked`).
- `src/components/admin/VariaveisEstruturaisForm.tsx` — formulário com todos os blocos e cartões de cálculo derivado em tempo real (`useMemo`).
- `src/components/admin/HistoricoAlteracoes.tsx` — tabela + dialog de detalhes/diff.
- `src/hooks/useHistoricoConfiguracao.ts` — query/insert do histórico.
- `src/components/Navigation.tsx` — adicionar link "Painel Administrador" (ícone `Lock`/`Shield`), exibido apenas se `sessionStorage.admin_panel_unlocked === 'true'` **OU** sempre visível mas levando à tela de senha (preferência: sempre visível, ícone discreto).
- `src/App.tsx` — registrar rota.

**Lógica de cálculo:**

- `src/lib/adminCustos.ts` (novo): função `calcularCustosPorTipo(folhaProducao, folhaAdmin, capacidades)` retorna `{ encapsulados:{mod,admin}, soluvel:{...}, gummy:{...}, liquido:{...} }`.
- `src/hooks/usePrecificacao.ts` / `precificacaoCalculator.ts`: ao montar `CustosIndiretos`, ler `mao_obra_direta_por_tipo[tipo]` e `despesas_admin_por_tipo[tipo]` da config ativa (com fallback para os campos legados); substituir `* 0.20` por `* (taxa_perca/100)`.

**Segurança:**
- Senha do painel é checada client-side (gate de UX). RLS já restringe escrita à role `authenticated`. Para reforço futuro, a senha pode ser movida para uma edge function que valida server-side, mas mantém escopo deste plano simples.
- Senha não fica em código fonte público: armazenada constante em `src/lib/adminConfig.ts` (mesmo padrão da senha operacional já existente no projeto).

**Compatibilidade com orçamentos antigos:**
- Não altera `orcamento_snapshot` nem nenhuma linha existente.
- Migração popula `folha_producao`/`folha_administrativa`/capacidades com `0`, e `taxa_perca = 20` (mantém comportamento atual até o admin editar).
- Os campos legados (`mao_obra_direta`, `despesas_administrativas`) continuam existindo e sendo atualizados automaticamente no salvamento (média ponderada das capacidades) para retrocompatibilidade com qualquer leitura legada.

## Arquivos a criar/editar

- **Migração SQL** (novas colunas + nova tabela `historico_configuracao_custos` + RLS)
- Criar: `src/pages/PainelAdministrador.tsx`, `src/components/admin/AdminPasswordGate.tsx`, `src/components/admin/VariaveisEstruturaisForm.tsx`, `src/components/admin/HistoricoAlteracoes.tsx`, `src/hooks/useHistoricoConfiguracao.ts`, `src/lib/adminCustos.ts`, `src/lib/adminConfig.ts`
- Editar: `src/App.tsx` (rota), `src/components/Navigation.tsx` (menu), `src/lib/precificacaoCalculator.ts` (taxa de perca), `src/hooks/usePrecificacao.ts` (custos por tipo), `src/types/precificacao.ts` (novos campos)

Pronto para implementar mediante aprovação.