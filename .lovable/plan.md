

## Plano: Botoes Opcionais de Frete/Cliente no Orcamento + Preview do PDF

### Objetivo
1. Adicionar botoes opcionais de "Info Cliente" e "Frete" no passo final (Step 4) do dialog de criacao de orcamento
2. Antes de baixar o PDF, mostrar um popup com preview do documento e botao de download

---

### 1. Modificacoes no GerarOrcamentoDialog.tsx

Adicionar no Step 4 (Resumo) botoes opcionais que abrem os dialogs existentes de InformacoesCliente e DetalhamentoFrete:

```text
STEP 4 - RESUMO DO ORCAMENTO (ATUALIZADO)
+--------------------------------------------------+
|  Consultor Responsavel: Maria Silva              |
|  Cliente: Farmacia ABC                           |
|                                                  |
|  PRODUCAO:                                       |
|  • Vitamina C 500mg (100un) - R$ 4.500,00        |
|  Subtotal: R$ 4.500,00                           |
|                                                  |
|  SERVICOS DE MARCA:                              |
|  • Plano Premium - R$ 500,00                     |
|  Subtotal: R$ 500,00                             |
|                                                  |
|  +--------------------------------------------+  |
|  |  VALOR TOTAL: R$ 5.000,00                  |  |
|  +--------------------------------------------+  |
|                                                  |
|  Validade: 30 dias                               |
|                                                  |
|  +--------------------------------------------+  |
|  |  ADICIONAR INFORMACOES (Opcional)          |  |
|  |                                             |  |
|  |  [User Icon] Info Cliente    [Truck] Frete |  |
|  |                                             |  |
|  |  Texto: "Esses dados podem ser adicionados |  |
|  |  depois na tela de orcamentos"             |  |
|  +--------------------------------------------+  |
|                                                  |
|          [Voltar]      [Salvar Orcamento]        |
+--------------------------------------------------+
```

Logica necessaria:
- Adicionar estados para controlar abertura dos dialogs inline
- Apos salvar o orcamento (handleSubmit), retornar o ID para poder usar nos dialogs
- Permitir editar dados de cliente/frete mesmo durante a criacao

---

### 2. Criar Novo Componente: PreviewPdfDialog.tsx

Dialog com preview do PDF antes de baixar:

```text
+--------------------------------------------------+
|            PREVIEW DO ORCAMENTO                  |
|             [X]                                  |
+--------------------------------------------------+
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |        [Renderizacao do PDF]               |  |
|  |                                            |  |
|  |   LEMON CAPS - ORCAMENTO COMERCIAL         |  |
|  |   Consultor: Maria Silva                   |  |
|  |   ...                                      |  |
|  |                                            |  |
|  |   CUSTOS DE PRODUCAO                       |  |
|  |   ...                                      |  |
|  |                                            |  |
|  |   VALOR TOTAL: R$ 5.000,00                 |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|                    [Baixar PDF]                  |
+--------------------------------------------------+
```

Implementacao:
- Usar jsPDF para gerar o PDF como blob
- Converter para data URL e exibir em iframe
- Botao de download usa a funcao existente generateOrcamentoPDF

---

### 3. Modificar orcamentoGenerator.ts

Adicionar funcao para gerar PDF como blob/data URL para preview:

```typescript
// Nova funcao para preview
export async function generateOrcamentoPDFBlob(
  orcamento: Orcamento
): Promise<Blob> {
  // Mesma logica do generateOrcamentoPDF
  // Mas retorna doc.output('blob') ao inves de doc.save()
}

// Funcao existente continua funcionando
export async function generateOrcamentoPDF(
  orcamento: Orcamento
): Promise<void> {
  // ... codigo existente ...
  doc.save(`${nomeArquivo}.pdf`);
}
```

---

### 4. Modificar Orcamentos.tsx

Atualizar handler do botao PDF para abrir preview primeiro:

```typescript
// Antes
const handleDownloadPDF = async (orcamento: Orcamento) => {
  await generateOrcamentoPDF(orcamento);
};

// Depois
const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null);

// Botao PDF abre o dialog de preview
onClick={() => setPreviewOrcamento(orcamento)}
```

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/GerarOrcamentoDialog.tsx` | Adicionar botoes opcionais de Info Cliente e Frete no Step 4 |
| `src/components/PreviewPdfDialog.tsx` | NOVO - Dialog com preview do PDF |
| `src/lib/orcamentoGenerator.ts` | Adicionar funcao generateOrcamentoPDFBlob para preview |
| `src/pages/Orcamentos.tsx` | Integrar PreviewPdfDialog antes de baixar |

---

### Detalhes Tecnicos

#### GerarOrcamentoDialog.tsx - Step 4 atualizado

```typescript
// Novos estados
const [showInfoCliente, setShowInfoCliente] = useState(false);
const [showFrete, setShowFrete] = useState(false);
const [dadosClienteTemp, setDadosClienteTemp] = useState<DadosCliente>({});
const [detalhamentoFreteTemp, setDetalhamentoFreteTemp] = useState<DetalhamentoFrete | null>(null);

// No Step 4, apos o resumo de valores:
{step === 4 && (
  <div className="space-y-4">
    {/* ... resumo existente ... */}
    
    {/* Secao opcional */}
    <Card className="border-dashed">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Adicionar informacoes (opcional):
        </p>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowInfoCliente(true)}
          >
            <User className="w-4 h-4 mr-2" />
            Info Cliente
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFrete(true)}
          >
            <Truck className="w-4 h-4 mr-2" />
            Frete
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Esses dados podem ser adicionados depois na tela de orcamentos
        </p>
      </CardContent>
    </Card>
  </div>
)}
```

#### PreviewPdfDialog.tsx

```typescript
interface PreviewPdfDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
  onDownload: () => void;
}

export default function PreviewPdfDialog({
  orcamento,
  onClose,
  onDownload,
}: PreviewPdfDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPreview() {
      try {
        const blob = await generateOrcamentoPDFBlob(orcamento);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Erro ao gerar preview:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPreview();
    
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [orcamento]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview do Orcamento</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border rounded-lg"
              title="Preview PDF"
            />
          ) : (
            <p>Erro ao carregar preview</p>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### orcamentoGenerator.ts - Nova funcao

```typescript
// Funcao interna que gera o documento
async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({...});
  // ... toda a logica de geracao ...
  return doc;
}

// Para preview (retorna blob)
export async function generateOrcamentoPDFBlob(
  orcamento: Orcamento
): Promise<Blob> {
  const doc = await createOrcamentoPDF(orcamento);
  return doc.output('blob');
}

// Para download (salva arquivo)
export async function generateOrcamentoPDF(
  orcamento: Orcamento
): Promise<void> {
  const doc = await createOrcamentoPDF(orcamento);
  const nomeArquivo = orcamento.consultor_responsavel 
    ? `${orcamento.consultor_responsavel.replace(/\s+/g, '-')}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`
    : `${orcamento.numero_orcamento}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`;
  doc.save(`${nomeArquivo}.pdf`);
}
```

---

### Sequencia de Implementacao

1. **Atualizar orcamentoGenerator.ts** - Refatorar para ter funcao de preview
2. **Criar PreviewPdfDialog.tsx** - Novo componente de preview
3. **Atualizar Orcamentos.tsx** - Integrar preview antes do download
4. **Atualizar GerarOrcamentoDialog.tsx** - Adicionar botoes opcionais no Step 4

---

### Fluxo do Usuario

#### Criando Orcamento:
1. Step 1: Informacoes basicas (consultor, cliente)
2. Step 2: Adicionar produtos
3. Step 3: Adicionar servicos de marca
4. Step 4: Resumo + botoes opcionais de Info Cliente e Frete
5. Salvar Orcamento

#### Baixando PDF:
1. Na lista de orcamentos, clicar em "PDF"
2. Abre dialog com preview do documento
3. Usuario visualiza o PDF renderizado
4. Clicar em "Baixar PDF" para fazer download

