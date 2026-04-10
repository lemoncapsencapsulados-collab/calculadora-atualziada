

## Plano: Botão "Copiar Relatório" para WhatsApp em cada Pedido

### Objetivo
Adicionar em cada card de pedido um botão que copia para a área de transferência um texto formatado com os dados do pedido, pronto para colar no WhatsApp.

### Formato do texto copiado

```text
Nome do consultor: KILSON
Nome da Cliente: SOLANGE FRANK
Tipo de produtor: Novo produtor
Valor da venda: 17.200,00
E-mail: solangefrank@gmail.com
Cnpj: 64.264.827/0001-95
Telefone: (65) 99258-9912
Cidade: Chapada dos Guimarães/MT

Comissão de 5% do valor da venda: R$ 860,00
```

- Se `tipo_orcamento === 'novo_produtor'` → "Novo produtor" + comissão de **5%**
- Se `tipo_orcamento === 'recompra'` → "Recompra" + comissão de **1%**

### Alteração

**Arquivo: `src/pages/Pedidos.tsx`**

1. Criar função `copiarRelatorioWhatsApp(pedido)` que:
   - Extrai do `orcamento_snapshot`: `consultor_responsavel`, `nome_cliente`, `valor_total`, `tipo_orcamento`
   - Extrai de `dados_cliente`: `email`, `cnpj`, `telefone`, `cidade`, `estado`
   - Monta o texto com formatação fixa (linhas separadas)
   - Calcula comissão (5% novo produtor, 1% recompra) e adiciona ao final
   - Usa `navigator.clipboard.writeText()` e exibe toast de confirmação

2. Adicionar botão/ícone "Copiar Relatório" no card de cada pedido (ao lado dos botões existentes de relatório PDF/Excel), usando ícone `Copy` do lucide-react

### Detalhes técnicos
- Dados já disponíveis no `orcamento_snapshot` carregado em memória
- Nenhuma query adicional necessária
- Nenhuma dependência nova

