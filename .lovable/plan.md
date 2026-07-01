## Objetivo
Adicionar ao topo do dialog **"Projeto para Contrato"** um card **"Resumo do Orçamento em Tempo Real"** que reflete, a cada edição, tudo que foi preenchido — funcionando como um espelho vivo do que será enviado ao financeiro.

## Onde
Arquivo único: `src/components/PropostaCompletaDialog.tsx`. Inserção logo abaixo do parágrafo introdutório (linha ~1389), antes do "Card 1. Informações do Cliente". Sticky no topo do container rolável para permanecer visível enquanto o usuário rola.

## Conteúdo do card (reagindo aos states já existentes)

1. **Cabeçalho / Tags** — badges destacadas:
   - Nº do orçamento (`orcamento.numero_orcamento`)
   - Tipo: `Novo Produtor` ou `Recompra` (`orcamento.tipo_orcamento`)
   - Modelo: `Print on Demand` se qualquer item tiver `modelo_negocio === 'print_on_demand'`, senão `Pedido sob Estoque`
   - Consultor responsável (`orcamento.consultor_responsavel` ou "Não informado")

2. **Cliente** (lê `tipoPessoa`, `dadosCliente`, `responsavelPJ`, `pessoasFisicas`):
   - PJ: Razão Social, CNPJ formatado, IE/IM (se preenchidos), endereço completo (rua, cep, cidade/estado), email, telefone, responsável (nome + CPF)
   - PF: nome, CPF, RG, endereço, email, telefone
   - Placeholder "—" quando vazio, para o usuário ver o que ainda falta

3. **Produtos / Fórmulas** (lê `orcamento.itens_producao` + `detalhesProducao`):
   - Uma linha por item: `Nome do produto` · `segmento` · `qtd × preço unit` · `subtotal`
   - Se houver `insumos_formula` → linha secundária com ingredientes obfuscados (aplicando a regra "Amido de Milho → Excipiente")
   - Se tiver `detalhes_producao` já editados (cor tampa, cor pote, sabor…) → mostra abaixo em texto reduzido
   - Badge "POD" quando `modelo_negocio === 'print_on_demand'`

4. **Serviços de marca / Setup / Entregáveis** (lê `orcamento.servicos_marca`):
   - Nome do plano · valor
   - Lista de entregáveis com `incluso` marcado (nome × quantidade)

5. **Frete** (lê `detalhamentoEnvio`):
   - "Envio total pela Lemon Caps ao cliente final" ou "Envio total ao Produtor (CNPJ)"
   - Descrição parcial se preenchida

6. **Pagamento** (lê `condicoesPagamento`):
   - Método selecionado, número de parcelas, valores e vencimentos
   - Ícone verde ✓ quando `validarCondicoesPagamento()` retorna sem erros; amarelo ⚠ caso contrário

7. **Totais** (usa valores já expostos no orçamento e recalculados):
   - Subtotal Produção (`subtotal_producao`)
   - Subtotal Serviços (`subtotal_servicos`)
   - **Valor Total** em destaque (formatado via `formatCurrencyPrecise`)

## Design
- `Card` do shadcn com header `sticky top-0 z-10 bg-background` e borda para destacar.
- Grid 2 colunas em telas ≥ md, 1 coluna no mobile.
- Reaproveita `Badge`, `Separator` e utilitários existentes (`formatCurrencyPrecise`, `obfuscateInsumo`).
- Sem novas dependências, sem chamadas de rede — tudo derivado dos states já em memória via `useMemo` para evitar recomputações.

## Fora de escopo
- Não altera o PDF gerado nem o e-mail enviado.
- Não muda validações, botões ou fluxo de envio já implementados.
- Não persiste nada novo no banco.
