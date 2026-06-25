# Nova Etapa: Custos de Estabilidade + Notificação Anvisa

Adicionar uma nova etapa intermediária no fluxo "Gerar Orçamento" entre o Passo 3 (Setup) e o atual Passo 4 (Cliente). O fluxo passa de **5 para 6 passos**.

## Quando aparece
- Apenas quando o perfil de Setup escolhido for **Novo Produtor** ou **Produtor Experiente**.
- **Revenda Lemon pula** essa etapa automaticamente.

## Regra de cálculo
- **R$ 1.500,00 por produto** × quantidade de itens de produção do Passo 2.
- **R$ 2.500,00 por fórmula** × quantidade de itens (1 item = 1 produto = 1 fórmula).
- Total embutido como **linha separada nos Serviços de Marca** do orçamento, com nome: `Teste de Estabilidade + Notificação Anvisa`.
- Descrição do serviço inclui o detalhamento (`X produtos × R$ 1.500 + X fórmulas × R$ 2.500`) e o aviso de prazo:
  > "Prazo para início de vendas: 3 meses após teste de estabilidade. Produto entra em estabilidade após 10 dias úteis (desenvolvimento da ficha técnica pela equipe técnica)."

## Tela do novo passo (UI)
Card único com:
- Resumo dos itens contabilizados (lista dos produtos do Passo 2).
- Quadro com 2 linhas editáveis (valor unitário Estabilidade e valor unitário Anvisa) — **bloqueadas por padrão**.
- Botão "Editar valores" → abre `AdminPasswordDialog` (senha `0212`); ao validar, libera os inputs.
- Total calculado destacado.
- Bloco informativo com os prazos (3 meses + 10 dias úteis).
- Botão "Confirmar e continuar".

## Editabilidade
- Valores padrão: R$ 1.500 / R$ 2.500.
- Edição requer senha admin (reuso do componente `AdminPasswordDialog` já existente).
- Estado persiste enquanto o dialog de Gerar Orçamento estiver aberto.

## Integração com Orçamento gerado
- Ao finalizar, adicionar automaticamente um item em `servicos_marca`:
  ```
  { nome_plano: "Teste de Estabilidade + Notificação Anvisa",
    descricao: "<detalhamento + aviso de prazo>",
    valor: <total>,
    entregaveis: [] }
  ```
- Soma entra no `subtotal_servicos` e `valor_total` normalmente.
- Aparece como linha separada no PDF (`orcamentoGenerator.ts`) e na Proposta (`propostaGenerator.ts`) sem precisar de mudanças adicionais — já são iterados.

## Arquivos a alterar
- `src/components/GerarOrcamentoDialog.tsx`
  - Aumentar total de passos de 5 → 6.
  - Inserir novo passo após o atual Passo 3 (Setup) e antes do Cliente.
  - Pular o passo se perfil = `revenda`.
  - Injetar serviço calculado no `servicos_marca` final.
- `src/components/orcamento/EstabilidadeAnvisaStep.tsx` *(novo)* — UI da etapa.
- Sem mudanças em backend/migração (valores são apenas do orçamento; senha admin já existe via `AdminPasswordDialog`).

## Fora de escopo
- Não cria tabela de configuração para os valores padrão (ficam constantes no front; edição pontual por orçamento via senha).
- Não altera Revenda Lemon nem o fluxo de Recompra.
