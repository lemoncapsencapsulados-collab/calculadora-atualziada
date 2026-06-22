## Objetivo

No Passo 3 do "Gerar Orçamento", manter o comportamento atual quando o perfil é **Novo Produtor** (4 planos fixos da tabela `setup_planos`), e voltar a UI completa antiga ("plano personalizado") quando o perfil for **Produtor Experiente** — com a seleção de itens (Código de barras, Design de rótulos, Página de vendas, INPI, Impressão por tipo), modo de cálculo (Margem % ou Valor fixo), comissão do vendedor, impostos e margem de lucro.

## Estado atual

- `SetupPlanosStep` mostra a tela de escolha de perfil e, em qualquer perfil escolhido, lista os planos de `setup_planos`.
- Para "Produtor Experiente" não há planos cadastrados → tela vazia ("Nenhum plano cadastrado").
- Os estados legados (`setupItems`, `setupImpressaoItens`, `margemSetup`, `modoCalculoSetup`, `valorFixoSetup`, `setupMargemLiberada`, etc.) ainda existem no `GerarOrcamentoDialog`, mas a UI que os renderizava foi removida (presente em commits anteriores, ex.: `d2599cf`).

## Mudanças

### 1. `src/components/orcamento/SetupPlanosStep.tsx`
- Manter a tela de escolha de perfil (Novo Produtor / Produtor Experiente).
- Continuar renderizando a lista de planos **apenas** quando `perfil === 'novo_produtor'`.
- Quando `perfil === 'produtor_experiente'`, expor um "slot" via children/render-prop ou — mais simples — não renderizar a área de planos e devolver controle ao pai. Implementação: adicionar prop `renderCustomBody?: ReactNode` exibida no lugar da grade de planos quando perfil = produtor_experiente. Cabeçalho ("Custo de Setup — Produtor Experiente" + "Trocar perfil") permanece.

### 2. `src/components/GerarOrcamentoDialog.tsx` — STEP 3

Reintroduzir a UI legada do setup (referência: commit `d2599cf`, linhas ~1338–1730) dentro de um novo bloco renderizado **somente quando `setupPerfil === 'produtor_experiente'`**. Itens:

- Lista de itens fixos com checkbox + quantidade + custo unitário:
  - Código de barras (R$ 5,70)
  - Design de rótulos (R$ 200)
  - Página de vendas (R$ 300)
  - Registro de Marca no INPI (R$ 880)
- Card "Custo de Impressão" com checkbox; quando marcado, linhas por tipo de produto (`setupImpressaoItens`) derivadas dos itens de produção, com custo unitário editável (protegido pelo dialog de senha já existente — `senhaImpressaoDialog`).
- Resumo de custos selecionados (subtotal de custos).
- Tabs / botões para alternar `modoCalculoSetup` entre **Margem %** e **Valor fixo**:
  - Margem: input `margemSetup` (com validação por `validarMargemPorTipo` e dialog de senha `senhaSetupDialog` já existentes para liberar margem abaixo do mínimo).
  - Valor fixo: input `valorFixoSetup`.
- Componente de margem efetiva e preço final (mesmas regras já existentes em utilitários: comissão consultor, impostos 16%, margem-alvo por tipo).

A renderização desta UI será passada via `renderCustomBody` para o `SetupPlanosStep`.

### 3. Cálculo de `precoVendaSetup` e `buildServicosMarca`

Adaptar para dois fluxos:

```text
se setupPerfil === 'novo_produtor':
    precoVendaSetup = Σ (plano.preco_fixo × qtd)   // já existe
    buildServicosMarca() devolve 1 entrada por plano

se setupPerfil === 'produtor_experiente':
    custoTotalSetup = Σ (setupItems selecionados × qtd × custoUnitario)
                    + Σ (setupImpressaoItens × qtd × custoUnitario)
    precoVendaSetup = 
        modoCalculoSetup === 'valor_fixo'
            ? valorFixoSetup
            : calcular preço a partir do custo + margem + impostos + comissão
              (mesma fórmula legada já existente nos utilitários)
    buildServicosMarca() devolve 1 entrada "Setup personalizado" com:
        - lista de entregáveis = itens selecionados (com qtd)
        - valor = precoVendaSetup
        - setup_detalhes = { modo_calculo, margem, valor_fixo,
                             itens: [...], impressao: [...], perfil: 'produtor_experiente' }
```

### 4. Restauração de orçamento existente

`useEffect` que restaura `orcamentoExistente`:
- Se algum `servicos_marca[i].setup_detalhes.plano_id` existir → fluxo Novo Produtor (já funciona).
- Caso contrário, se houver `setup_detalhes` no formato legado (campos `itens`, `impressao`, `modo_calculo`, `margem`, `valor_fixo`) → setar `setupPerfil = 'produtor_experiente'` e restaurar `setupItems`, `setupImpressaoItens`, `margemSetup`, `valorFixoSetup`, `modoCalculoSetup`.

### 5. STEP 5 — Resumo

No bloco "SETUP" do resumo:
- Se `setupPerfil === 'produtor_experiente'`: listar os itens legados selecionados (Código de barras, INPI, Impressão por tipo, etc.) com seus subtotais e o preço final do setup.
- Se `setupPerfil === 'novo_produtor'`: continuar listando os planos (comportamento atual).

### 6. Banco de dados

Sem migrações — a tabela `setup_planos` continua existindo, apenas não é consultada para o perfil "Produtor Experiente". Os planos do perfil "produtor_experiente" inseridos em testes podem ficar inativos sem efeito visual.

## Arquivos afetados

- `src/components/orcamento/SetupPlanosStep.tsx` — aceitar `renderCustomBody` e pular grade de planos para "Produtor Experiente".
- `src/components/GerarOrcamentoDialog.tsx` — reintroduzir UI legada do setup; ajustar `precoVendaSetup`, `buildServicosMarca`, restauração e Step 5.

Nenhum outro arquivo precisa mudar (helpers de cálculo, PDF e propostas já consomem `servicos_marca`/`setup_detalhes` genéricos).
