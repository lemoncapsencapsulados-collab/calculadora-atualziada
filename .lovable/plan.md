

## Plano: Sistema de Precificacoes Salvas com Edicao e Recalculo em Tempo Real

### Objetivo
Criar uma sub-pagina "Precificacoes Salvas" dentro da pagina de Precificacao Final que:
1. Mostra automaticamente apos salvar uma precificacao
2. Lista todas as precificacoes salvas de forma organizada
3. Permite editar o preco de venda e ver os calculos atualizados em tempo real
4. Permite editar custo por formula ou custo total
5. Exibe margem de lucro em porcentagem E em dinheiro (R$)

### Arquitetura

A pagina de Precificacao sera dividida em duas abas usando Tabs:
1. **Nova Precificacao** - Tela atual de calculo
2. **Precificacoes Salvas** - Lista com edicao inline

```
+--------------------------------------------------+
|  [Nova Precificacao]  [Precificacoes Salvas]     |
+--------------------------------------------------+
|                                                  |
|  Lista de precificacoes salvas...                |
|                                                  |
+--------------------------------------------------+
```

---

### Componentes a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `src/pages/Precificacao.tsx` | Adicionar sistema de abas e redirecionar apos salvar |
| `src/components/PrecificacoesSalvas.tsx` | Novo componente para listar e editar precificacoes |
| `src/components/EditarPrecificacaoDialog.tsx` | Dialog para edicao de precificacao com recalculo |
| `src/hooks/usePrecificacao.ts` | Adicionar mutation para atualizar precificacao |

---

### Detalhes da Implementacao

#### 1. Modificar usePrecificacao.ts

Adicionar funcao para atualizar precificacao existente:

```typescript
// Atualizar precificacao existente
const atualizarPrecificacao = useMutation({
  mutationFn: async (precificacao: Partial<Precificacao> & { id: string }) => {
    const { data, error } = await supabase
      .from('precificacoes')
      .update(precificacao)
      .eq('id', precificacao.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
    toast.success('Precificacao atualizada com sucesso!');
  },
});
```

#### 2. Modificar Precificacao.tsx

Adicionar sistema de abas:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PrecificacoesSalvas from '@/components/PrecificacoesSalvas';

// Estado para controlar aba ativa
const [abaAtiva, setAbaAtiva] = useState('nova');

// Apos salvar, mudar para aba de precificacoes salvas
const handleSalvar = async () => {
  // ... codigo existente ...
  await salvarPrecificacao.mutateAsync({...});
  
  // Redirecionar para aba de precificacoes salvas
  setAbaAtiva('salvas');
  setFormulaSelecionada(null);
  toast.success('Precificacao salva! Redirecionando...');
};
```

Interface com Tabs:

```tsx
<Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
  <TabsList className="grid w-full max-w-md grid-cols-2">
    <TabsTrigger value="nova">
      <Calculator className="w-4 h-4 mr-2" />
      Nova Precificacao
    </TabsTrigger>
    <TabsTrigger value="salvas">
      <FileText className="w-4 h-4 mr-2" />
      Precificacoes Salvas
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="nova">
    {/* Conteudo atual da pagina */}
  </TabsContent>
  
  <TabsContent value="salvas">
    <PrecificacoesSalvas 
      configuracaoAtiva={configuracaoAtiva}
      margens={margens}
    />
  </TabsContent>
</Tabs>
```

#### 3. Novo Componente: PrecificacoesSalvas.tsx

Lista organizada com cards expansiveis:

```
+--------------------------------------------------+
| Precificacoes Salvas                             |
+--------------------------------------------------+
| [Pesquisar por cliente ou formula...]            |
+--------------------------------------------------+
|                                                  |
| +----------------------------------------------+ |
| | Cliente: Farmacia XYZ                        | |
| | Formula: Vitamina C 1000mg                   | |
| | Tipo: Encapsulados                           | |
| | Data: 15/01/2025                             | |
| |                                              | |
| | Preco Venda: R$ 45,00                        | |
| | Custo Producao: R$ 18,00                     | |
| | Margem: 35,2% (R$ 15,84)                     | |
| |                                              | |
| | [Editar] [Excluir]                           | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |
| | Cliente: Lab ABC                             | |
| | ...                                          | |
| +----------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

Estrutura do componente:

```typescript
interface PrecificacoesSalvasProps {
  configuracaoAtiva: ConfiguracaoCustos | null;
  margens: MargemLucro[] | null;
}

export default function PrecificacoesSalvas({ 
  configuracaoAtiva, 
  margens 
}: PrecificacoesSalvasProps) {
  const { precificacoes, isLoading, deletarPrecificacao } = usePrecificacao();
  const [searchTerm, setSearchTerm] = useState('');
  const [editandoPrecificacao, setEditandoPrecificacao] = useState<any>(null);

  // Filtrar precificacoes
  const precificacoesFiltradas = precificacoes?.filter(p => {
    const termo = searchTerm.toLowerCase();
    return (
      p.formulas?.nome_formula?.toLowerCase().includes(termo) ||
      p.formulas?.cliente?.toLowerCase().includes(termo)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Busca */}
      <Input 
        placeholder="Pesquisar por cliente ou formula..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      {/* Lista de precificacoes */}
      {precificacoesFiltradas.map(precificacao => (
        <Card key={precificacao.id}>
          <CardContent className="p-4">
            {/* Informacoes da precificacao */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold">{precificacao.formulas?.nome_formula}</p>
                <p className="text-sm text-muted-foreground">
                  {precificacao.formulas?.cliente}
                </p>
                <Badge>{precificacao.formulas?.tipo_produto}</Badge>
              </div>
              
              {/* Valores principais destacados */}
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  R$ {precificacao.preco_venda.toFixed(2)}
                </p>
                <div className="flex items-center justify-end gap-2 mt-2">
                  <span className="text-lg font-semibold text-green-600">
                    {precificacao.margem_lucro_percentual.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    (R$ {precificacao.margem_lucro_valor.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
            
            {/* Acoes */}
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setEditandoPrecificacao(precificacao)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button variant="destructive" onClick={() => deletarPrecificacao.mutate(precificacao.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Dialog de edicao */}
      {editandoPrecificacao && (
        <EditarPrecificacaoDialog
          precificacao={editandoPrecificacao}
          configuracaoAtiva={configuracaoAtiva}
          margens={margens}
          onClose={() => setEditandoPrecificacao(null)}
        />
      )}
    </div>
  );
}
```

#### 4. Novo Componente: EditarPrecificacaoDialog.tsx

Dialog com edicao e recalculo em tempo real:

```
+--------------------------------------------------+
|          Editar Precificacao                 [X] |
+--------------------------------------------------+
|                                                  |
| Formula: Vitamina C 1000mg                       |
| Cliente: Farmacia XYZ                            |
|                                                  |
| +----------------------------------------------+ |
| |               CUSTOS BASE                    | |
| +----------------------------------------------+ |
| | Custo Materia-Prima:    R$ [____8.50____]    | |
| | Custo Embalagem:        R$ [____2.30____]    | |
| | ---                                          | |
| | Custo Formula (Diretos): R$ 10.80            | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |
| |               PRECO DE VENDA                 | |
| +----------------------------------------------+ |
| | Preco de Venda (R$):    [______45.00______]  | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |
| |         RESULTADO (recalculado)              | |
| +----------------------------------------------+ |
| | Custo Total Producao:   R$ 12.96             | |
| | Total Impostos:         R$ 13.20             | |
| |                                              | |
| | +------------------------------------------+ | |
| | |       MARGEM DE LUCRO                    | | |
| | |  +------------------------------------+  | | |
| | |  |   35.2%         R$ 15.84           |  | | |
| | |  +------------------------------------+  | | |
| | +------------------------------------------+ | |
| |                                              | |
| | [Status: Excelente! Acima do ideal]          | |
| +----------------------------------------------+ |
|                                                  |
|           [Cancelar]    [Salvar Alteracoes]      |
+--------------------------------------------------+
```

Funcionalidades do dialog:

```typescript
interface EditarPrecificacaoDialogProps {
  precificacao: PrecificacaoComFormula;
  configuracaoAtiva: ConfiguracaoCustos | null;
  margens: MargemLucro[] | null;
  onClose: () => void;
}

export default function EditarPrecificacaoDialog({
  precificacao,
  configuracaoAtiva,
  margens,
  onClose
}: EditarPrecificacaoDialogProps) {
  const { atualizarPrecificacao } = usePrecificacao();
  
  // Estados editaveis
  const [precoVenda, setPrecoVenda] = useState(precificacao.preco_venda.toString());
  const [custoMP, setCustoMP] = useState(precificacao.custo_materia_prima.toString());
  const [custoEmbalagem, setCustoEmbalagem] = useState(precificacao.custo_embalagem.toString());
  
  // Recalculo em tempo real
  const resultado = useMemo(() => {
    if (!configuracaoAtiva) return null;
    
    const preco = parseFloat(precoVenda) || 0;
    const mp = parseFloat(custoMP) || 0;
    const emb = parseFloat(custoEmbalagem) || 0;
    
    const custosBase = {
      custoMateriaPrima: mp,
      custoEmbalagem: emb,
    };
    
    const custosIndiretos = {
      maoObraDireta: precificacao.custo_mao_obra_direta,
      energia: precificacao.custo_energia,
      depreciacao: precificacao.custo_depreciacao,
      administrativo: precificacao.custo_administrativo,
    };
    
    return calcularPrecificacaoPorPreco(custosBase, custosIndiretos, preco, configuracaoAtiva);
  }, [precoVenda, custoMP, custoEmbalagem, configuracaoAtiva, precificacao]);

  // Validacao de margem
  const validacaoMargem = useMemo(() => {
    if (!resultado || !margens) return null;
    const margem = margens.find(m => m.tipo_produto === precificacao.formulas?.tipo_produto);
    if (!margem) return null;
    return validarMargem(resultado.margemLucroPercentual, margem.margem_ideal, margem.margem_minima);
  }, [resultado, margens, precificacao]);

  const handleSalvar = async () => {
    if (!resultado) return;
    
    await atualizarPrecificacao.mutateAsync({
      id: precificacao.id,
      custo_materia_prima: resultado.custoMateriaPrima,
      custo_embalagem: resultado.custoEmbalagem,
      // ... todos os campos recalculados
      preco_venda: resultado.precoVenda,
      margem_lucro_percentual: resultado.margemLucroPercentual,
      margem_lucro_valor: resultado.margemLucroValor,
    });
    
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {/* Cabecalho */}
        <DialogHeader>
          <DialogTitle>Editar Precificacao</DialogTitle>
        </DialogHeader>
        
        {/* Informacoes da formula */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <p className="font-semibold">{precificacao.formulas?.nome_formula}</p>
            <p className="text-sm text-muted-foreground">{precificacao.formulas?.cliente}</p>
          </div>
          <Badge>{precificacao.formulas?.tipo_produto}</Badge>
        </div>
        
        {/* Campos editaveis */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Custo Materia-Prima (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={custoMP}
              onChange={(e) => setCustoMP(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Custo Embalagem (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={custoEmbalagem}
              onChange={(e) => setCustoEmbalagem(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Preco de Venda (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={precoVenda}
            onChange={(e) => setPrecoVenda(e.target.value)}
          />
        </div>
        
        {/* Resultado recalculado */}
        {resultado && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Custo Total Producao</p>
                <p className="font-semibold">R$ {resultado.totalCustosProducao.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Impostos</p>
                <p className="font-semibold">R$ {resultado.totalImpostos.toFixed(2)}</p>
              </div>
            </div>
            
            {/* Destaque da margem */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg text-center">
              <p className="text-sm font-medium text-green-700 mb-2">Margem de Lucro</p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-3xl font-bold text-green-600">
                  {resultado.margemLucroPercentual.toFixed(1)}%
                </span>
                <span className="text-xl font-semibold text-green-700">
                  R$ {resultado.margemLucroValor.toFixed(2)}
                </span>
              </div>
            </div>
            
            {/* Validacao */}
            {validacaoMargem && (
              <p className={`text-sm font-medium ${validacaoMargem.color}`}>
                {validacaoMargem.mensagem}
              </p>
            )}
          </div>
        )}
        
        {/* Acoes */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={!resultado}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Alteracoes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Fluxo do Usuario

1. Usuario vai para "Precificacao Final"
2. Seleciona uma formula e insere o preco de venda
3. Clica em "Salvar Precificacao"
4. Sistema redireciona automaticamente para aba "Precificacoes Salvas"
5. Usuario ve a lista de todas as precificacoes salvas
6. Pode clicar em "Editar" em qualquer precificacao
7. Dialog abre com campos editaveis (preco, custo MP, custo embalagem)
8. Conforme edita, os calculos sao atualizados em tempo real
9. Margem aparece sempre em % e R$ de forma destacada
10. Ao salvar, a precificacao e atualizada no banco

---

### Campos Editaveis no Dialog

| Campo | Editavel | Afeta Calculo |
|-------|----------|---------------|
| Preco de Venda | Sim | Sim |
| Custo Materia-Prima | Sim | Sim |
| Custo Embalagem | Sim | Sim |
| Custos Indiretos | Nao (usa valores originais) | - |
| Impostos | Nao (recalculados automaticamente) | - |
| Margem | Nao (resultado do calculo) | - |

---

### Exibicao da Margem

A margem sera sempre exibida de duas formas:
1. **Percentual**: 35.2%
2. **Valor**: R$ 15.84

Em destaque visual com cores:
- Verde: Margem acima do ideal
- Amarelo: Margem aceitavel (entre minima e ideal)
- Vermelho: Margem abaixo da minima

---

### Arquivos a Criar

1. `src/components/PrecificacoesSalvas.tsx` - Componente de listagem
2. `src/components/EditarPrecificacaoDialog.tsx` - Dialog de edicao

### Arquivos a Modificar

1. `src/pages/Precificacao.tsx` - Adicionar Tabs e redirecionar apos salvar
2. `src/hooks/usePrecificacao.ts` - Adicionar mutation de atualizacao

