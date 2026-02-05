
## Plano: Melhorias no Sistema de Orcamentos

### Resumo das Solicitacoes

1. **Detalhamento de Envio no Frete**: Opcao para dividir producao entre envio para o produtor e logistica pela Lemon Caps
2. **Informacoes do Produto**: Adicionar quantidade por pote (Po/Capsula/Gummy/ML) e dose diaria sugerida na selecao de produtos
3. **Dois Botoes de PDF**: "Gerar Orcamento" (simples, sem cliente/frete) e "Proposta Completa" (com cliente e frete)
4. **Edicao Completa**: Ao editar, permitir voltar ate a etapa de escolha de produtos

---

### 1. Alteracoes no Tipo ItemProducao

Adicionar campos para quantidade por pote e dose diaria:

```typescript
export interface ItemProducao {
  // campos existentes...
  quantidade_por_pote?: number;      // Ex: 60 capsulas, 200ml, 150g
  unidade_por_pote?: string;         // "capsulas", "ml", "g", "gummies"
  dose_diaria_sugerida?: string;     // "2 capsulas ao dia", "10ml", etc.
}
```

---

### 2. Alteracoes no DetalhamentoFrete

Adicionar campo para detalhamento de envio parcial:

```typescript
export interface DetalhamentoEnvio {
  tipo: 'total_produtor' | 'total_lemoncaps' | 'parcial';
  descricao_parcial?: string;  // Ex: "50% para produtor, 50% logistica Lemon Caps"
}

export interface DetalhamentoFrete {
  frete_lemon_caps: boolean;
  usa_tabela_tradicional: boolean;
  planos_customizados: PlanoFreteCustomizado[];
  detalhamento_envio?: DetalhamentoEnvio;  // NOVO
}
```

---

### 3. Modificar GerarOrcamentoDialog.tsx

#### Step 2 - Adicionar Campos no Produto

Ao adicionar precificacao ou produto avulso, incluir inputs para:
- Quantidade por pote (numero)
- Unidade (select: capsulas, gummies, ml, g)
- Dose diaria sugerida (texto livre)

#### Edicao Completa

Quando `orcamentoExistente` existir, permitir navegar para qualquer step (nao apenas resumo).

---

### 4. Modificar DetalhamentoFreteDialog.tsx

Adicionar secao de "Detalhamento de Envio":

```text
DETALHAMENTO DE ENVIO
+--------------------------------------------------+
|  Como sera feita a logistica?                    |
|                                                  |
|  ( ) Todo envio para o Produtor                  |
|  ( ) Toda logistica via Lemon Caps               |
|  ( ) Envio Parcial                               |
|                                                  |
|  [Se parcial selecionado]                        |
|  +----------------------------------------------+|
|  | Descreva a divisao:                          ||
|  | [___________________________________________]||
|  | Ex: "50 potes para produtor, 100 potes       ||
|  | logistica Lemon Caps"                        ||
|  +----------------------------------------------+|
+--------------------------------------------------+
```

---

### 5. Modificar Orcamentos.tsx - Dois Botoes de PDF

Substituir botao "PDF" por dois botoes:

```text
ACOES DO ORCAMENTO
+--------------------------------------------------+
|  [Info Cliente] [Frete] [Editar]                 |
|                                                  |
|  [Gerar Orcamento]     [Proposta Completa]       |
|  (sem cliente/frete)   (com cliente e frete)     |
|                                                  |
|  [Excluir]                                       |
+--------------------------------------------------+
```

- **Gerar Orcamento**: Gera PDF sem dados do cliente e sem frete
- **Proposta Completa**: Abre dialog para preencher Info Cliente e Frete antes de gerar PDF

---

### 6. Criar PropostaCompletaDialog.tsx

Dialog que solicita Info Cliente e Frete antes de gerar a proposta completa:

```text
+--------------------------------------------------+
|         GERAR PROPOSTA COMPLETA                  |
|                    [X]                           |
+--------------------------------------------------+
|                                                  |
|  Para gerar a proposta completa, preencha:       |
|                                                  |
|  [1. INFORMACOES DO CLIENTE]                     |
|  +--------------------------------------------+  |
|  | Nome: [_______________________]            |  |
|  | Email: [______________________]            |  |
|  | Telefone: [___________________]            |  |
|  | CNPJ: [_______________________] [Buscar]   |  |
|  +--------------------------------------------+  |
|                                                  |
|  [2. DETALHAMENTO DE FRETE]                      |
|  +--------------------------------------------+  |
|  | Frete via Lemon Caps? [Sim] [Nao]          |  |
|  | Detalhamento de Envio: [______________]    |  |
|  +--------------------------------------------+  |
|                                                  |
|           [Cancelar]  [Gerar Proposta]           |
+--------------------------------------------------+
```

Apos preencher, salva os dados no orcamento e gera o PDF completo.

---

### 7. Atualizar PDF Generator

Adicionar novas secoes:
- Quantidade por pote e dose diaria para cada produto
- Detalhamento de envio na secao de frete

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/types/orcamento.ts` | Adicionar campos `quantidade_por_pote`, `unidade_por_pote`, `dose_diaria_sugerida` em `ItemProducao` e `detalhamento_envio` em `DetalhamentoFrete` |
| `src/components/GerarOrcamentoDialog.tsx` | Adicionar inputs de quantidade/dose no Step 2, permitir edicao completa navegando entre steps |
| `src/components/DetalhamentoFreteDialog.tsx` | Adicionar secao de detalhamento de envio (total produtor, total lemoncaps, parcial) |
| `src/pages/Orcamentos.tsx` | Trocar botao "PDF" por "Gerar Orcamento" e "Proposta Completa" |
| `src/components/PropostaCompletaDialog.tsx` | NOVO - Dialog para preencher cliente/frete antes de gerar proposta |
| `src/lib/orcamentoGenerator.ts` | Incluir quantidade por pote, dose diaria e detalhamento de envio no PDF |

---

### Detalhes Tecnicos

#### Tipos atualizados (orcamento.ts)

```typescript
export interface ItemProducao {
  tipo: 'precificacao' | 'avulso';
  precificacao_id?: string;
  nome_produto: string;
  segmento: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
  insumos_formula?: InsumoSnapshot[];
  // NOVOS CAMPOS
  quantidade_por_pote?: number;
  unidade_por_pote?: string;
  dose_diaria_sugerida?: string;
}

export interface DetalhamentoEnvio {
  tipo: 'total_produtor' | 'total_lemoncaps' | 'parcial';
  descricao_parcial?: string;
}

export interface DetalhamentoFrete {
  frete_lemon_caps: boolean;
  usa_tabela_tradicional: boolean;
  planos_customizados: PlanoFreteCustomizado[];
  detalhamento_envio?: DetalhamentoEnvio;
}
```

#### Step 2 - Campos do Produto

Apos adicionar produto, exibir campos editaveis:

```typescript
<div className="grid grid-cols-3 gap-2 mt-2">
  <div className="space-y-1">
    <Label className="text-xs">Qtd por Pote</Label>
    <Input
      type="number"
      value={item.quantidade_por_pote || ''}
      onChange={(e) => handleUpdateItemField(index, 'quantidade_por_pote', parseInt(e.target.value))}
      placeholder="60"
    />
  </div>
  <div className="space-y-1">
    <Label className="text-xs">Unidade</Label>
    <Select
      value={item.unidade_por_pote || ''}
      onValueChange={(value) => handleUpdateItemField(index, 'unidade_por_pote', value)}
    >
      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="capsulas">Capsulas</SelectItem>
        <SelectItem value="gummies">Gummies</SelectItem>
        <SelectItem value="ml">ML</SelectItem>
        <SelectItem value="g">Gramas</SelectItem>
      </SelectContent>
    </Select>
  </div>
  <div className="space-y-1">
    <Label className="text-xs">Dose Diaria</Label>
    <Input
      value={item.dose_diaria_sugerida || ''}
      onChange={(e) => handleUpdateItemField(index, 'dose_diaria_sugerida', e.target.value)}
      placeholder="2 capsulas/dia"
    />
  </div>
</div>
```

#### Botoes na Pagina Orcamentos

```typescript
// Substituir botao PDF por:
<Button 
  variant="outline" 
  size="sm"
  onClick={() => handleGerarOrcamentoSimples(orcamento)}
>
  <FileText className="w-4 h-4 mr-2" />
  Gerar Orcamento
</Button>
<Button 
  variant="default" 
  size="sm"
  onClick={() => setPropostaCompletaOrcamento(orcamento)}
>
  <FileCheck className="w-4 h-4 mr-2" />
  Proposta Completa
</Button>
```

#### PDF Generator - Nova Secao por Produto

```typescript
// Apos nome do produto, adicionar detalhes:
if (item.quantidade_por_pote && item.unidade_por_pote) {
  doc.text(`Apresentacao: ${item.quantidade_por_pote} ${item.unidade_por_pote}/pote`, x, yPos);
  yPos += 4;
}
if (item.dose_diaria_sugerida) {
  doc.text(`Dose diaria sugerida: ${item.dose_diaria_sugerida}`, x, yPos);
  yPos += 4;
}
```

#### PDF Generator - Detalhamento de Envio

```typescript
// Na secao de frete, adicionar:
if (frete.detalhamento_envio) {
  const tipoLabels = {
    'total_produtor': 'Todo envio para o Produtor',
    'total_lemoncaps': 'Toda logistica via Lemon Caps',
    'parcial': 'Envio Parcial',
  };
  doc.text(`Logistica: ${tipoLabels[frete.detalhamento_envio.tipo]}`, margin + 5, yPos);
  yPos += 5;
  
  if (frete.detalhamento_envio.tipo === 'parcial' && frete.detalhamento_envio.descricao_parcial) {
    doc.text(`Detalhes: ${frete.detalhamento_envio.descricao_parcial}`, margin + 10, yPos);
    yPos += 5;
  }
}
```

---

### Fluxo do Usuario

#### Criando Orcamento:
1. Step 1: Consultor + Cliente
2. Step 2: Adicionar produtos COM quantidade/pote e dose diaria
3. Step 3: Servicos de marca
4. Step 4: Resumo + opcoes de Info Cliente e Frete
5. Salvar

#### Editando Orcamento:
- Clicar em "Editar" abre dialog no Step 1
- Usuario pode navegar livremente entre todos os steps
- Pode modificar produtos, quantidades, doses, etc.

#### Gerando PDF Simples:
1. Clicar em "Gerar Orcamento"
2. Abre preview do PDF (sem dados de cliente e frete)
3. Baixar

#### Gerando Proposta Completa:
1. Clicar em "Proposta Completa"
2. Abre dialog para preencher/revisar Info Cliente e Frete
3. Salva os dados
4. Abre preview do PDF completo
5. Baixar

---

### Sequencia de Implementacao

1. **Atualizar tipos** - `src/types/orcamento.ts`
2. **Atualizar DetalhamentoFreteDialog** - Adicionar secao de detalhamento de envio
3. **Atualizar GerarOrcamentoDialog** - Adicionar campos quantidade/dose e permitir edicao completa
4. **Criar PropostaCompletaDialog** - Novo componente para proposta completa
5. **Atualizar Orcamentos.tsx** - Substituir botao PDF pelos dois novos botoes
6. **Atualizar PDF Generator** - Incluir novos campos no PDF

