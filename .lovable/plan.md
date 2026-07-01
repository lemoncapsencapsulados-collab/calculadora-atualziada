
## O que muda

### 1. Remover o plano "FAÇA VOCÊ MESMO" do fluxo Novo Produtor
- Desativar o registro `FAÇA VOCÊ MESMO` na tabela `setup_planos` (marcar `ativo = false`).
- Ele deixa de aparecer no Passo 3 do "Novo Orçamento" (perfil Novo Produtor) — some o card do plano, os entregáveis e o preço (R$ 1.999,90).
- Os outros três planos continuam: START, BRANDING e PREMIUM.
- **Por que soft-delete e não `DELETE`:** orçamentos antigos que foram salvos com esse plano guardam a referência no snapshot. Desativar preserva o histórico sem quebrar nada; só some do formulário de novo orçamento.

### 2. Remover a notificação "Prazos importantes" no Passo 4
- No componente do Passo 4 (Estabilidade + Notificação Anvisa), apagar o card amarelo "Prazos importantes" que lista os prazos de 10 dias úteis e 6 meses.
- Também remover a linha do texto de descrição do serviço (`ESTABILIDADE_PRAZO_TEXTO`) que hoje é anexada automaticamente na descrição do orçamento gerado, para que essa comunicação suma de ponta a ponta.

### 3. Deixar explícito que Fórmulas do Catálogo não têm custo de estabilidade
- No Passo 4, substituir a mensagem atual (`Todos os itens são do Catálogo Lemon — sem custo de teste de estabilidade`) por um aviso mais destacado, em card verde, dizendo:
  - "Fórmulas do Catálogo Lemon são isentas do teste de estabilidade."
  - "Nesse caso, o único custo aplicado é a Notificação na Anvisa por produto."
- Esse aviso aparece sempre que houver itens de catálogo no orçamento, mesmo quando também há fórmulas personalizadas (mostrando quais itens são isentos).

## Detalhes técnicos

- Alteração de dados: `UPDATE public.setup_planos SET ativo = false WHERE nome = 'FAÇA VOCÊ MESMO';`
- Frontend afetado:
  - `src/components/orcamento/EstabilidadeAnvisaStep.tsx` — remover o card "Prazos importantes" (linhas 154–168) e reformular a mensagem de catálogo.
  - `src/components/GerarOrcamentoDialog.tsx` — remover a constante `ESTABILIDADE_PRAZO_TEXTO` da descrição do serviço "Teste de Estabilidade" (linha ~479).
- Não é necessário mudar a listagem de planos: ela já filtra por `ativo = true` via `setup_planos`.
