## Objetivo

Adicionar uma terceira opção **"REVENDA LEMON"** na seleção de perfil do Passo 3 (Custo de Setup) do Gerar Orçamento. Ao escolhê-la, o orçamento segue **sem nenhum custo de setup** (`precoVendaSetup = 0`, `servicos_marca = []`), mantendo apenas o custo de produção dos itens.

Restrição: o botão só fica **habilitado quando 100% dos itens de produção do orçamento são fórmulas do Catálogo** (i.e., a precificação vinculada tem `formulas.cliente` contendo "catálogo"/"catalogo", mesma regra usada em `isCatalogo` no `GerarOrcamentoDialog.tsx`). Caso contrário, o card aparece desabilitado com tooltip/aviso "Disponível apenas quando todos os itens são fórmulas do Catálogo".

## Mudanças

### 1. `src/hooks/useSetupPlanos.ts`
- Expandir o tipo `SetupPlanoPerfil` para `'novo_produtor' | 'produtor_experiente' | 'revenda_lemon'`.

### 2. `src/components/orcamento/SetupPlanosStep.tsx`
- Adicionar um terceiro card **"REVENDA LEMON"** na grade de escolha de perfil, ao lado de Novo Produtor e Produtor Experiente. Visual coerente (ícone próprio, cor de destaque). Texto: "Para clientes que apenas revendem produtos Lemon. Sem custo de setup — apenas custo de produção."
- Receber duas novas props:
  - `revendaDisponivel: boolean` — controla se o card fica clicável.
  - `revendaMotivoBloqueio?: string` — texto exibido em badge/aviso quando desabilitado (ex.: "Disponível apenas quando todos os itens são fórmulas do Catálogo").
- Quando `perfil === 'revenda_lemon'`, não renderizar grade de planos nem `renderCustomBody`. Em vez disso, mostrar bloco confirmando: "Sem custo de setup. Total de setup: R$ 0,00."

### 3. `src/components/GerarOrcamentoDialog.tsx`

- Calcular `todosItensSaoCatalogo`:
  ```ts
  const todosItensSaoCatalogo =
    itensProducao.length > 0 &&
    itensProducao.every((it) => {
      if (it.tipo !== 'precificacao' || !it.precificacao_id) return false;
      const prec = (precificacoes as any[])?.find((p) => p.id === it.precificacao_id);
      return prec && isCatalogo(prec.formulas?.cliente || '');
    });
  ```
- Passar `revendaDisponivel={todosItensSaoCatalogo}` e mensagem de bloqueio ao `SetupPlanosStep`.
- Ajustar `precoVendaSetup` e `buildServicosMarca`:
  - Se `setupPerfil === 'revenda_lemon'` → `precoVendaSetup = 0` e `buildServicosMarca()` retorna `[]`.
  - Demais perfis: lógica atual.
- Ajustar `canProceed` no Passo 3 para permitir avançar quando `setupPerfil === 'revenda_lemon'` (sem validação de margem/itens).
- Passo 5 (Resumo): quando `setupPerfil === 'revenda_lemon'`, exibir bloco "Setup: Revenda Lemon — sem custo de setup (R$ 0,00)".
- Restauração de orçamento existente: se `servicos_marca` estiver vazio e existir marcador (ver item 4) → setar `setupPerfil = 'revenda_lemon'`.

### 4. Persistência do perfil "Revenda Lemon"

Como `servicos_marca` fica `[]`, precisamos marcar o orçamento para restaurar corretamente:
- Gravar `observacoes_internas` com um marcador estruturado **ou** — mais limpo — adicionar uma única entrada simbólica em `servicos_marca`:
  ```json
  { "nome_plano": "Revenda Lemon", "valor": 0, "entregaveis": [], "setup_detalhes": { "perfil": "revenda_lemon" } }
  ```
  Essa entrada não aparece no PDF (filtrar `valor === 0 && setup_detalhes?.perfil === 'revenda_lemon'` nos geradores) e serve apenas como flag.
- Decisão recomendada: usar a **entrada simbólica em `servicos_marca`** (consistente com a forma como já distinguimos "novo_produtor" vs "produtor_experiente" via `setup_detalhes`).
- `subtotal_servicos = 0` e `valor_total = subtotal_producao` nesse fluxo.

### 5. PDF / Proposta

- Em `src/lib/pdfGenerator.ts` e `src/lib/propostaGenerator.ts`: ignorar entradas com `setup_detalhes?.perfil === 'revenda_lemon'` ao listar serviços de marca, e exibir apenas a seção de produção. (Pequeno ajuste defensivo — confirmar na implementação.)

## Sem mudanças de banco

Nenhuma migração: usamos os campos JSON existentes (`servicos_marca` / `setup_detalhes`).

## Arquivos afetados

- `src/hooks/useSetupPlanos.ts`
- `src/components/orcamento/SetupPlanosStep.tsx`
- `src/components/GerarOrcamentoDialog.tsx`
- `src/lib/pdfGenerator.ts` (filtro defensivo)
- `src/lib/propostaGenerator.ts` (filtro defensivo)
