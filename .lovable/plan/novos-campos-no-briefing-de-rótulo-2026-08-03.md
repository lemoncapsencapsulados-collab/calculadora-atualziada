# Novos campos no briefing de Rótulo

## O que muda

Na Demanda de Marca do tipo **Rótulo**:

1. **Orçamento de marca pensado em: X rótulos comprados** — campo numérico com a quantidade de rótulos comprados considerada no orçamento.
2. **Orçamento de rótulo pensado na produção feita em** — seleção múltipla entre: Cuiabá, Sergio, São Paulo Premium.
3. **Tipo de papel** — nova opção "Personalizado", além de Metalizado, Perolizado e Transparente.
4. **Quantidade de potes** (por produto) — rótulo do campo passa a ser "Quantidade de Potes Vendidos".

Os dois novos campos ficam no bloco superior do formulário (junto de Tipo de papel / Posicionamento) e passam a sair também no briefing em PDF e na task enviada ao ClickUp.

## Detalhes técnicos

- `src/types/demandaMarca.ts`: adicionar `Personalizado` em `TIPOS_PAPEL`; nova constante `LOCAIS_PRODUCAO = ['Cuiabá', 'Sergio', 'São Paulo Premium']`; em `DadosRotulo`, novos campos opcionais `orcamento_qtd_rotulos?: number` e `locais_producao?: string[]`.
- `src/components/pedidos/demandas/FormRotulo.tsx`: input numérico e grupo de checkboxes para os locais de produção; troca do label "Quantidade de potes" para "Quantidade de Potes Vendidos"; validação exigindo quantidade de rótulos maior que zero e ao menos um local selecionado.
- `src/lib/demandasMarcaPdf.ts`: novas linhas "Orçamento de marca pensado em" e "Produção pensada em" na seção de rótulo.
- `supabase/functions/clickup-enviar-demanda/index.ts`: incluir os dois campos na descrição markdown da task de Rótulo.

Demandas já salvas continuam funcionando — os campos são opcionais e ficam vazios até serem editados.