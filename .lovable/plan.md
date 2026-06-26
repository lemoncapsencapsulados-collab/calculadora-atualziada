## Mudanças solicitadas

1. **Nova seção no PDF de orçamento**: separar a estrutura visual em três blocos:
   - **PRODUTOS** (já existe)
   - **SERVIÇOS DE PRODUÇÃO** (novo — abriga Teste de Estabilidade + Notificação Anvisa, em linhas separadas)
   - **SERVIÇOS DE MARCA** (já existe — abriga os planos de Setup)

2. **Separar Estabilidade e Anvisa em duas linhas distintas** (hoje vão como uma linha única "Teste de Estabilidade + Notificação Anvisa").

3. **Novos valores padrão**:
   - Teste de Estabilidade: **R$ 4.100,00 por produto**
   - Notificação Anvisa: **R$ 1.750,00 por produto** (antes era "por fórmula" — passa a ser por produto, idêntico à base de cálculo da estabilidade)

4. **Prazo atualizado**: início de vendas passa de **3 meses → 6 meses** após o início do teste de estabilidade (mantém os 10 dias úteis de ficha técnica).

---

## Arquivos alterados

### `src/components/GerarOrcamentoDialog.tsx`
- `CUSTO_ESTABILIDADE_PADRAO` → `4100`.
- `CUSTO_ANVISA_PADRAO` → `1750`.
- `ESTABILIDADE_PRAZO_TEXTO` → "6 meses" no lugar de "3 meses".
- Ao montar `servicos_marca`, em vez de injetar **1 entrada combinada**, injetar **2 entradas separadas**, cada uma marcada com `setup_detalhes.categoria = 'producao'` (nova flag) para o PDF saber renderizá-las na seção "Serviços de Produção":
  - `"Teste de Estabilidade"` — descrição: `"X produto(s) × R$ 4.100,00. Prazo: produto entra em estabilidade após 10 dias úteis; início de vendas 6 meses após o teste."`
  - `"Notificação Anvisa do Produto"` — descrição: `"X produto(s) × R$ 1.750,00."`
- Restauração de orçamento existente: ler ambas as entradas (compatibilidade com a entrada antiga combinada — fallback que divide o valor antigo).

### `src/components/orcamento/EstabilidadeAnvisaStep.tsx`
- Trocar label "Notificação Anvisa (por fórmula)" → **"Notificação Anvisa (por produto)"**.
- Atualizar texto auxiliar para "X produtos × R$ ..." nos dois inputs.
- Atualizar bloco de prazos: "3 meses" → **"6 meses"**.

### `src/lib/orcamentoGenerator.ts`
- Em `renderServicos`, dividir `servicos_marca` em dois grupos pelo flag `setup_detalhes?.categoria`:
  - `'producao'` → renderizar primeiro, sob o título **"Serviços de Produção"** (mesmo estilo de tabela; sem subtotal próprio destacado, ou com subtotal próprio — escolha: **com subtotal próprio** "SUBTOTAL SERV. DE PRODUÇÃO").
  - demais → renderizar sob o título atual **"Serviços de Marca"** com o subtotal atual ("SUBTOTAL SERVIÇOS" representando o subtotal de marca).
- Se uma das listas estiver vazia, pular sua seção (mantém retrocompatibilidade com orçamentos antigos sem `categoria`).
- O `subtotal_servicos` financeiro continua sendo a soma de tudo (não muda contabilidade).

### `src/components/DetalhesPedidoDialog.tsx`
- Pequeno ajuste: ao listar serviços, se houver itens com `categoria='producao'`, mostrar separador visual "Serviços de Produção" acima e "Serviços de Marca" para o resto. (Mantém estilo atual; sem mudança de cálculo.)

### Sem alteração
- `src/lib/propostaGenerator.ts` (proposta usa apenas o total agregado, não lista linhas).
- `src/lib/relatoriosPedidos.ts` (continua somando `subtotal_servicos`).
- Backend / migrações: nenhuma.

---

## Notas

- Orçamentos antigos (com a linha única "Teste de Estabilidade + Notificação Anvisa" sem `categoria`) continuam renderizando — o filtro só **adiciona** a nova seção quando encontra `categoria='producao'`. Se quiser, posso adicionar uma migração leve no front que, ao restaurar, transforma o item antigo em dois novos automaticamente para edições futuras (incluído no plano).
- Os valores permanecem editáveis com a senha `0212` (sem mudanças no `AdminPasswordDialog`).
- Revenda Lemon continua pulando a etapa.