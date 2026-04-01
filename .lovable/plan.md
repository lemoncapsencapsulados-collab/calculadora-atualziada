

## Plano atualizado: Reestruturar condições de pagamento

### Resumo
Substituir a estrutura atual de 4 métodos por 3 métodos (Pix/Boleto, Cartão de Crédito, Misto), com suporte a parcelas, escolha entre porcentagem ou valor fixo, **e validação obrigatória de que a soma dos pagamentos é igual ao valor total do orçamento**.

### Nova estrutura de dados (`src/types/orcamento.ts`)

Novos tipos:
- `MetodoPagamentoPrincipal`: `'pix_boleto' | 'cartao_credito' | 'misto'`
- `ParcelaPixBoleto`: `{ tipo_valor: 'percentual' | 'fixo', valor: number }`
- `CartaoPagamento`: `{ tipo_valor: 'percentual' | 'fixo', valor: number, parcelas: number }`
- `CondicoesPagamento` atualizado com: `metodo_principal`, `parcelas_pix_boleto`, `cartoes`, `misto_parcelas_pix_boleto`, `misto_cartoes`

Campos legados mantidos para compatibilidade mas não usados pela nova UI.

### UI (`src/components/CondicoesPagamentoForm.tsx`) — reescrita completa

**Seleção do método:** 3 botões (Pix/Boleto, Cartão de Crédito, Misto)

**Pix/Boleto:** Quantidade de parcelas (+/-), cada uma com toggle % ou R$ + input

**Cartão de Crédito:** Quantidade de cartões (+/-), cada um com toggle % ou R$, input de valor, seletor de parcelas (1-6x com juros)

**Misto:** Combina seções Pix/Boleto + Cartão de Crédito

**Juros:** Mantém constantes atuais `{1: 0, 2: 0, 3: 0, 4: 0.07, 5: 0.08, 6: 0.09}`

### Validação de soma total (novo requisito)

- O componente exibirá em tempo real a **soma dos valores configurados** vs **valor total do orçamento**
- Quando a soma não bater com o total: indicador vermelho com a diferença (faltam R$ X ou excedem R$ X)
- Quando bater: indicador verde "✓ Valores conferem"
- **Bloqueio**: os consumidores (GerarOrcamentoDialog, AprovacaoOrcamentoDialog, PropostaCompletaDialog) não permitirão prosseguir enquanto a soma não for igual ao total
- Para porcentagem: soma das % deve ser exatamente 100%
- Para valor fixo: soma dos R$ deve ser igual ao `valorTotal` passado via props
- Para misto: soma de todos os itens (Pix/Boleto + Cartão) deve atingir 100% ou o valor total

O componente exportará uma função `validarCondicoesPagamento(condicoes, valorTotal)` que retorna `{ valido: boolean, mensagem?: string }`.

### Arquivos alterados
1. `src/types/orcamento.ts` — novos tipos
2. `src/components/CondicoesPagamentoForm.tsx` — nova UI completa com validação de soma
3. Consumidores (GerarOrcamentoDialog, AprovacaoOrcamentoDialog, PropostaCompletaDialog) — adicionar chamada à validação antes de prosseguir

