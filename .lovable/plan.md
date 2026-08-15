# Intermediador no orçamento (comissão 3% / 1%)

Novo passo de confirmação entre "Estabilidade + Notificação Anvisa" e "Condições de Pagamento", com resumo do valor total e comissão opcional de intermediador.

## O que muda no fluxo

O assistente passa de 6 para 7 passos:

```text
1 Cliente  2 Produtos  3 Setup  4 Estabilidade/Anvisa
5 Confirmação do Orçamento + Intermediador   (novo)
6 Condições de Pagamento    7 Revisão final
```

(No perfil Revenda Lemon o passo de Estabilidade continua sendo pulado; o novo passo aparece normalmente.)

## Passo novo: Confirmação do Orçamento

Resumo em cartão:
- Produção (produtos e quantidades) — subtotal
- Setup / Criação de marca — subtotal
- Estabilidade + Notificação Anvisa (se houver) — subtotal
- **Valor total do orçamento**

Botão/switch "Adicionar Intermediador". Quando ativado:
- Campos **Nome do intermediador** e **WhatsApp** (máscara e validação de telefone, salvos apenas neste orçamento).
- Percentual aplicado automaticamente pelo tipo do orçamento: **3%** para Novo Produtor (primeira compra) e **1%** para Recompra. Os dois percentuais aparecem na tela; o não aplicado fica como referência.
- Percentuais editáveis somente após liberar com a **senha de administrador** (mesmo diálogo já usado nos outros passos).
- Cálculo exibido:
  - Base: valor total do orçamento
  - **Comissão do intermediador** (R$)
  - **Margem Lemon de Produção** antes e depois da comissão (usa o custo unitário de cada precificação, mesma fórmula de margem já compartilhada, imposto 12%)
  - **Margem Lemon de Setup** antes e depois da comissão
  - **Margem total Lemon** após comissão, em R$ e %
  - A comissão é rateada entre Produção e Setup na proporção de cada subtotal no total.

A comissão **não altera** o valor total cobrado do cliente — é dedução de margem interna.

## Onde o intermediador aparece

- **PDF do Orçamento (cliente):** nada muda. Nenhuma menção a intermediador.
- **Projeto para Contrato:** nova seção interna "Intermediador" com nome, WhatsApp, percentual aplicado e valor da comissão.
- **Pedidos:** bloco "Intermediador" nos detalhes do pedido (nome, WhatsApp com link, percentual, valor da comissão), para o fechamento mensal.

## Detalhes técnicos

- Novo tipo `IntermediadorOrcamento { nome, whatsapp, percentual, tipo_base: 'primeira_compra' | 'recompra', valor_comissao }` em `src/types/orcamento.ts`, persistido em uma coluna `intermediador` (jsonb, nullable) da tabela `orcamentos` — migração simples, sem novas tabelas. O snapshot do pedido já copia o orçamento, então o dado chega em Pedidos.
- `GerarOrcamentoDialog.tsx`: renumeração dos passos, novo componente `src/components/orcamento/ConfirmacaoIntermediadorStep.tsx`, estado do intermediador e persistência no insert/update.
- Cálculo de margem centralizado num helper (`src/lib/intermediador.ts`) reaproveitando `calcularMargemLiquida` de `precificacaoCalculator.ts` e o custo de setup já calculado no passo 3.
- `generateOrcamentoPDF/Blob` em `src/lib/orcamentoGenerator.ts` ganha uma opção `incluirIntermediador` (default `false`); o Projeto para Contrato passa `true`, o download do orçamento continua sem.
- `DetalhesPedidoDialog.tsx`: nova seção lendo `orcamento_snapshot.intermediador`.
- WhatsApp reutiliza `src/lib/whatsapp.ts` (validação, formatação e link).
