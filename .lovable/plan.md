## Reorganização do Painel Administrador → Variáveis Estruturais

Apenas mudança visual em `src/components/admin/VariaveisEstruturaisForm.tsx`. Sem alterações de lógica, cálculo ou banco.

### Nova ordem dos cards

1. Folha da Produção (Folha + Energia mensal)
2. Capacidade mensal de produção
3. Despesas Administrativas (tabela com totais)
4. **Divisória visual** (`<Separator />` com margem vertical maior, ex.: `my-4`) para separar entradas (acima) dos resultados derivados (abaixo)
5. Custo unitário derivado (Mensal ÷ Capacidade) — movido para baixo
6. Depreciação e Taxa de Perca (permanece ao final)

### Implementação

- Recortar o `<Card>` "Custo unitário derivado" (linhas 366–393) e colá-lo logo após o card "Despesas Administrativas".
- Inserir um `<Separator className="my-4" />` entre o card de Despesas Administrativas e o card "Custo unitário derivado" recolocado, deixando claro que tudo acima são entradas e tudo abaixo é resultado calculado.
- Nenhum outro arquivo é tocado.