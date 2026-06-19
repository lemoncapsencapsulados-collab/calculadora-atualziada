## Objetivo
Atualizar os preços (R$/kg) das matérias-primas do inventário usando a planilha `ESTOQUE_MATÉRIA_PRIMA_JUNHO_26.xlsx`.

## O que a planilha contém
Aba `ESTOQUE` com 155 linhas, uma linha por lote, incluindo:
- `ITEM/LOTE` (nome + às vezes sufixo de lote)
- `QTD TOTAL (KG/L)` (quantidade em estoque)
- `VALOR/KG` (preço por kg/L do lote)
- `FORNECEDOR`, validade, etc.

## Estratégia
1. Ler a aba `ESTOQUE` da planilha em um script local (não muda nada no projeto ainda).
2. Para cada linha:
   - Limpar o nome removendo sufixos de lote (códigos tipo `25H12-B041-...`, datas, e tamanhos como "5KG", "1KG", "10L") preservando o nome base da matéria-prima.
   - Considerar apenas lotes com `QTD TOTAL > 0` (lotes zerados ficam de fora para não distorcer).
3. Agrupar por nome base e calcular **média ponderada de `VALOR/KG`** pelo `QTD TOTAL`. Lotes únicos ficam com o preço do lote.
4. Enviar a lista resultante (`{ nome, preco_por_kg }`) para a edge function existente `import-materias-primas`, que já:
   - normaliza nomes (com aliases),
   - faz match com `materias_primas.normalized_name`,
   - converte o preço de kg para a `unidade_compra` cadastrada,
   - atualiza `preco_compra` e retorna um relatório (criados / atualizados / ignorados / alertas).
5. Mostrar o relatório final: quantas MPs foram atualizadas, quais não casaram (criadas novas ou ignoradas) e os aliases aplicados, para você revisar.

## Regras importantes
- **Não criar duplicatas**: se o nome base não bater com nenhuma MP existente nem com aliases, a função cria como nova MP em kg — vou destacar essas no relatório para você decidir se mantém ou apaga.
- **Amido de Milho**: permanece com o nome real no banco (a ofuscação para "Excipiente" é só na UI/PDF), então o preço será atualizado normalmente.
- **Sem mudança de schema** e sem mudança no app — só dados em `materias_primas.preco_compra` via a função já existente.

## Detalhes técnicos
- Script Python local (sandbox) lê o xlsx com pandas/openpyxl, agrega e POSTa para `import-materias-primas` autenticado.
- Nenhuma migração; nenhuma alteração em código do app.
