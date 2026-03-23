

# Plano: Limpeza de duplicatas + relatório + 4 correções de código

## Relatório de Duplicatas Encontradas

**119 fórmulas duplicadas** serão deletadas (mantendo a mais recente de cada grupo). Dessas, **36 fórmulas antigas** possuem precificações vinculadas que precisam ser redirecionadas. **Zero pedidos** são afetados.

### Precificações que precisam ser redirecionadas (36 registros em 30 clientes):

| Cliente | Fórmula | Precif. afetadas | Pedidos |
|---|---|---|---|
| Vinicius (João Ferrari) | Fórmula personalizada | 1 | 0 |
| Alex (Indicação matheus/otavio) | Formula personalizada de solúvel | 2 (2 IDs antigos) | 0 |
| BIANCA VIEIRA | FÓRMULA P/ GESTANTES | 1 | 0 |
| Boaz | Shot Colágeno Verisol | 1 | 0 |
| CAROL CAPLEVE | COLAGENO CAPSULAS | 1 | 0 |
| DR Hemilton | Levanta defunto em po | 3 (2 IDs antigos) | 0 |
| Dra Andrea BEM ESTAR SEM FUMAR | ANSIEDADE e IRRITABILIDADE | 2 (2 IDs antigos) | 0 |
| IGO SUPLEMNTA AI | PRÉ TREINO MANGA 320 PO | 1 | 0 |
| IGOR VILELA | NUTRONYCA SABOR LIMÃO 300G | 3 | 0 |
| KILSON | Calmaria Crianças | 1 | 0 |
| LEMON - LINHA PREMIUM- 01 | CREATINA GUMMY | 2 | 0 |
| LEMON CAPS | PRÉ-TREINO POTE 300G | 2 (2 IDs antigos) | 0 |
| Lemon caps | Emagrecimento cápsulas 60un | 1 | 0 |
| LEMON CAPS | MULTIVITAMICO GOTAS 30ML | 1 | 0 |
| LUCAS MAOZ | LAPSO 2 | 1 | 0 |
| LUCAS VIEIRA | FOCO - PERSONALIZADA | 4 (3 IDs antigos) | 0 |
| Maikon | Fórmula sem nome | 1 | 0 |
| MATEUS MACHADO | BRAINJUICE-GREENS SOLUVEL | 1 | 0 |
| MATOS (Kilson) | PRÉ TREINO | 1 | 0 |
| MATTOS SUPLEMENTOS | PRÉ TREINO 300G | 1 | 0 |
| Pedro Russo | Pré Treino | 2 | 0 |
| PINK CAPS | PC CAPS | 1 | 0 |
| PRISCILA LIMA (Derek) | Vitaminas | 1 | 0 |
| RODOLFO | FORMULA 1 DE 4 A 6 ANOS | 2 (2 IDs antigos) | 0 |
| ROSANA (CHINA - KILSON) | LIPEDEMA - LINHA PREMIUM | 1 | 0 |
| STELLA DR. PAULA | SONO FORMULA N 3 | 1 | 0 |
| Stella Linha premium | MELATONINA + TRIPTOFANO | 1 | 0 |
| TESTE | TESTE | 1 | 0 |
| Venicius | NAC | 1 | 0 |

**Nenhum pedido precisa ser atualizado.**

## Execução (3 passos via insert tool)

1. **UPDATE precificacoes**: Para cada `old_id` com precificações, atualizar `formula_id` para o `new_id` (a fórmula mais recente do grupo)
2. **Verificação**: Confirmar que nenhuma precificação aponta para IDs antigos
3. **DELETE formulas**: Remover as 119 fórmulas duplicadas antigas

## Correções de código (mesma implementação)

1. `VerFormulaDialog.tsx` — prop `readOnly` para esconder edição
2. `Precificacao.tsx` — rota `/` em vez de `/calculator`, readOnly no VerFormula, rótulo nos cards
3. `Calculator.tsx` — `.limit(1)` antes de `.maybeSingle()`
4. `PrecificacoesSalvas.tsx` — rótulo na lista de embalagens

