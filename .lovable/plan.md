

## Plano: Reestruturar passos do orçamento

### Resumo
O dialog passa de 4 para 5 passos:
1. Informações básicas (sem condições de pagamento)
2. Produtos de produção (bloqueio se vazio)
3. **Novo**: Custo de Setup (substitui serviços de marca)
4. Condições de pagamento (movido do passo 1)
5. Resumo + dados opcionais (antigo passo 4)

---

### Passo 2 — Bloqueio sem produtos
- Atualizar `canGoNext()`: se `step === 2`, exigir `itensProducao.length > 0`
- Exibir mensagem de aviso quando tentar avançar sem produtos

### Passo 3 — Custo de Setup (substituição completa)
Remove a estrutura atual de "Serviço de Criação de Marca" (planos/entregáveis) e substitui por um calculador de setup com itens selecionáveis:

**Itens de setup com checkbox + quantidade editável:**

| Item | Custo unitário | Quantidade padrão |
|------|---------------|-------------------|
| Código de barras | R$ 5,70 | = nº produtos do passo 2 |
| Design de rótulos | R$ 200,00 | = nº produtos do passo 2 |
| Impressão de rótulos | Variável por tipo | Lista por tipo de produto |
| Página de vendas | R$ 300,00 | = nº produtos do passo 2 |
| Registro de Marca INPI | R$ 880,00 | 1 |

**Custos de impressão por tipo:**
- Encapsulados: R$ 940,00
- Gummy: R$ 1.340,00
- Líquido: R$ 740,00
- Solúvel: R$ 1.590,00

Para "Impressão de rótulos", exibir uma sub-lista agrupada por tipo de produto com quantidade de produtos daquele tipo (editável).

**Fórmula de preço de venda do setup:**
```text
Preço Venda = Custo Total / (1 - 0.06 - 0.05 - 0.05 - margem%)
```
Onde margem% é preenchida pelo usuário (input editável).

**Validação de margem (mesmo padrão visual dos produtos):**
- Minima: 15% (abaixo = vermelho, bloqueio com senha `0B%s8QP2Z+Do`)
- Ideal: 20% (verde)
- Rica (Lemon Rica): 25%+ (dourado, animação)

Usar mesmos estilos visuais e padrão de cores do `validarMargemPorTipo` existente, adicionando config "Setup" ao `MARGENS_CONFIG`.

O valor final do setup será armazenado em `servicos_marca` como um único item (compatibilidade com estrutura existente), com os detalhes nos entregáveis.

### Passo 4 — Condições de Pagamento
- Mover `CondicoesPagamentoForm` do passo 1 para o passo 4
- Remover campos "forma de pagamento" (textarea) do passo 1
- O `valorTotal` já estará calculado (produção + setup)

### Passo 5 — Resumo
- Antigo passo 4 vira passo 5, com info cliente e frete opcionais
- Atualizar header para "Passo X de 5"
- Atualizar navegação: `step < 5` para próximo, `step === 5` para salvar

### Detalhes Técnicos

**Arquivos alterados:**
1. `src/components/GerarOrcamentoDialog.tsx` — reescrita dos passos, nova lógica de setup
2. `src/lib/precificacaoCalculator.ts` — adicionar `'Setup': { minima: 15, idealInicio: 20, idealFim: 25 }` ao `MARGENS_CONFIG`

**Compatibilidade:** O setup salva como `servicos_marca` com a mesma estrutura, mantendo PDFs, aprovação e proposta funcionando sem alteração.

