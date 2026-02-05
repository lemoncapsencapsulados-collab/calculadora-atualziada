
## Plano: Remover Botoes Info Cliente/Frete e Adicionar Forma de Venda

### Resumo das Alteracoes

1. **Remover botoes "Info Cliente" e "Frete"** da lista de orcamentos em `Orcamentos.tsx`
2. **Adicionar campo "Forma de Venda"** no `PropostaCompletaDialog.tsx` com opcoes de multipla escolha

---

### 1. Modificar Orcamentos.tsx

Remover os dois botoes de Info Cliente e Frete da secao de acoes de cada orcamento (linhas 251-266):

**Antes:**
- Info Cliente
- Frete
- Editar
- Gerar Orcamento
- Proposta Completa
- Excluir

**Depois:**
- Editar
- Gerar Orcamento
- Proposta Completa
- Excluir

Tambem remover:
- Estados `infoClienteOrcamento` e `freteOrcamento`
- Imports dos dialogs `InformacoesClienteDialog` e `DetalhamentoFreteDialog`
- Renderizacao condicional desses dialogs
- Imports de icones `User` e `Truck` (se nao usados em outro lugar)

---

### 2. Modificar PropostaCompletaDialog.tsx

Adicionar secao "Forma de Venda do Cliente" com RadioGroup contendo as opcoes:

| Valor | Label |
|-------|-------|
| `locais_fisicos` | Locais físicos |
| `venda_digital` | Venda digital |
| `ambas` | Ambas |
| `sem_informacao` | Sem informação |

**Layout atualizado:**

```text
+--------------------------------------------------+
|         GERAR PROPOSTA COMPLETA                  |
+--------------------------------------------------+
|                                                  |
|  [1. INFORMACOES DO CLIENTE]                     |
|  +--------------------------------------------+  |
|  | Nome, Email, Telefone, CPF, CNPJ, etc      |  |
|  +--------------------------------------------+  |
|                                                  |
|  [2. FORMA DE VENDA DO CLIENTE]                  |
|  +--------------------------------------------+  |
|  | Como o cliente vende seus produtos?        |  |
|  |                                            |  |
|  | ( ) Locais físicos                         |  |
|  | ( ) Venda digital                          |  |
|  | ( ) Ambas                                  |  |
|  | ( ) Sem informação                         |  |
|  +--------------------------------------------+  |
|                                                  |
|  [3. DETALHAMENTO DE FRETE]                      |
|  +--------------------------------------------+  |
|  | Logistica, Frete Lemon Caps, etc           |  |
|  +--------------------------------------------+  |
|                                                  |
|           [Cancelar]  [Gerar Proposta]           |
+--------------------------------------------------+
```

---

### 3. Atualizar Tipos (Opcional - Para Persistir)

Adicionar campo `forma_venda` ao tipo `DadosCliente` em `src/types/orcamento.ts`:

```typescript
export interface DadosCliente {
  // campos existentes...
  forma_venda?: 'locais_fisicos' | 'venda_digital' | 'ambas' | 'sem_informacao';
}
```

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/Orcamentos.tsx` | Remover botoes Info Cliente e Frete, remover estados e imports relacionados |
| `src/components/PropostaCompletaDialog.tsx` | Adicionar secao "Forma de Venda" com RadioGroup de 4 opcoes |
| `src/types/orcamento.ts` | Adicionar `forma_venda` ao tipo `DadosCliente` |
| `src/lib/orcamentoGenerator.ts` | Incluir forma de venda no PDF (se preenchida) |

---

### Detalhes Tecnicos

#### PropostaCompletaDialog.tsx - Nova Secao

```typescript
// Novo estado
const [formaVenda, setFormaVenda] = useState<string>(
  orcamento.dados_cliente?.forma_venda || 'sem_informacao'
);

// No JSX, entre Info Cliente e Frete:
<Card>
  <CardHeader className="py-3">
    <CardTitle className="text-base flex items-center gap-2">
      <ShoppingBag className="w-4 h-4" />
      2. Forma de Venda do Cliente
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Label className="text-sm text-muted-foreground mb-3 block">
      Como o cliente vende seus produtos?
    </Label>
    <RadioGroup
      value={formaVenda}
      onValueChange={setFormaVenda}
      className="space-y-2"
    >
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="locais_fisicos" id="locais" />
        <Label htmlFor="locais" className="font-normal cursor-pointer">
          Locais físicos
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="venda_digital" id="digital" />
        <Label htmlFor="digital" className="font-normal cursor-pointer">
          Venda digital
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="ambas" id="ambas" />
        <Label htmlFor="ambas" className="font-normal cursor-pointer">
          Ambas
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="sem_informacao" id="sem-info" />
        <Label htmlFor="sem-info" className="font-normal cursor-pointer">
          Sem informação
        </Label>
      </div>
    </RadioGroup>
  </CardContent>
</Card>
```

#### Salvar no handleGenerateProposta

```typescript
// Incluir forma_venda nos dados do cliente
const dadosClienteCompletos = {
  ...dadosCliente,
  forma_venda: formaVenda as DadosCliente['forma_venda'],
};

await updateDadosCliente.mutateAsync({
  id: orcamento.id,
  dados_cliente: dadosClienteCompletos,
});
```

---

### Sequencia de Implementacao

1. **Atualizar tipos** - Adicionar `forma_venda` em `DadosCliente`
2. **Atualizar PropostaCompletaDialog** - Adicionar secao de forma de venda
3. **Limpar Orcamentos.tsx** - Remover botoes e dialogs de Info Cliente/Frete
4. **Atualizar PDF Generator** - Incluir forma de venda no PDF
