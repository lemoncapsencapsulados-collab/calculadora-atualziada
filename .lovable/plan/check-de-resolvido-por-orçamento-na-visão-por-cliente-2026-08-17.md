# Check de "Resolvido" por orçamento na visão Por cliente

Na aba "Por cliente" dos Insights e Alertas, cada orçamento listado dentro do cliente ganha um check de resolução. O check só é confirmado depois de preencher uma observação, e o item resolvido fica destacado em verde — continuando visível na lista.

## Como funciona

1. Ao expandir um cliente, cada linha de orçamento passa a ter um botão de check ("Marcar como resolvido").
2. Clicar abre um diálogo com número do orçamento, cliente, vendedor, valor e um campo de observação obrigatório (botão desabilitado enquanto vazio).
3. Ao confirmar, a linha fica verde com ícone de check, mostrando a observação, quem resolveu e a data/hora.
4. Um botão "Desfazer" na própria linha remove a marcação.
5. Orçamentos resolvidos deixam de contar nas métricas de alerta/sem retorno do card do vendedor, mas seguem visíveis.

## Persistência compartilhada

O status fica no banco, então todos os gestores veem a mesma informação — não fica só no navegador.

Nova tabela `insight_resolucoes`:

```text
id                  uuid
orcamento_id        uuid (único)
numero_orcamento    texto
cliente             texto
consultor           texto
observacao          texto (obrigatória)
resolvido_por       uuid do usuário
resolvido_por_email texto
created_at / updated_at
```

Acesso: leitura e escrita para usuários autenticados, mesmo padrão das demais tabelas operacionais do painel.

## Detalhes técnicos

- Migração cria a tabela com `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, RLS habilitada, políticas para `authenticated`, índice único em `orcamento_id` e trigger `update_updated_at_column`.
- Novo hook `src/hooks/useInsightResolucoes.ts` (React Query): lista as resoluções, `marcarResolvido` (upsert por `orcamento_id`) e `desfazerResolucao`, invalidando a query e emitindo toast.
- Novo componente `src/components/dashboard/ResolverOrcamentoDialog.tsx`: resumo do orçamento, textarea de observação obrigatória e botão "Confirmar resolução".
- `src/components/dashboard/InsightsPorCliente.tsx`: recebe o mapa de resoluções por `orcamento_id`, renderiza o check por item, aplica o estilo verde e exclui itens resolvidos das contagens de alerta/sem retorno.
- O verde vem de um token semântico de sucesso no design system (`src/index.css` / `tailwind.config.ts`), sem cores hardcoded.
- A visão "Por orçamento" não muda; `src/lib/insightsPorCliente.ts` só passa a ignorar itens resolvidos nas contagens.