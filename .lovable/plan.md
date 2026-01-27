

## Plano: Adicionar Upload de Imagem com OCR/IA ao Popup "Importar Dose Copiada"

### Objetivo
Adicionar funcionalidade de anexar imagem/foto ao popup existente de "Importar Dose Copiada", onde a imagem sera processada automaticamente usando IA (Lovable AI com modelo Gemini) para extrair os insumos e quantidades, que serao exibidos na previa e importados para a formula.

### Fluxo do Usuario

1. Usuario clica em "Adicionar Dose copiada"
2. Popup abre com duas opcoes:
   - Colar texto (funcionalidade atual)
   - Anexar imagem (nova funcionalidade)
3. Ao anexar imagem:
   - Imagem aparece como preview
   - Sistema envia para edge function com Lovable AI
   - IA extrai os insumos e quantidades
   - Resultado e parseado e exibido na previa (igual ao texto)
4. Usuario clica "IMPORTAR DOSE" para adicionar a formula

### Arquitetura Tecnica

```
[Frontend: ImportarDoseDialog]
         |
         | (imagem base64)
         v
[Edge Function: extract-dose-from-image]
         |
         | (Lovable AI Gateway)
         v
[Gemini 2.5 Flash - Vision]
         |
         | (texto extraido)
         v
[Frontend: parseTextoInsumos()]
         |
         v
[Preview dos itens]
```

### Componentes a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `src/components/ImportarDoseDialog.tsx` | Adicionar upload de imagem e integracao |
| `supabase/functions/extract-dose-from-image/index.ts` | Nova edge function para OCR com IA |
| `supabase/config.toml` | Adicionar configuracao da nova funcao |

---

### Detalhes da Implementacao

#### 1. Nova Edge Function: `extract-dose-from-image`

A funcao recebe uma imagem em base64 e usa o Lovable AI Gateway com modelo Gemini 2.5 Flash (que suporta imagens) para extrair os insumos.

**Prompt para a IA:**
```
Analise esta imagem de uma formula ou lista de suplementos.
Extraia TODOS os ingredientes/insumos com suas quantidades.

Formato de saida (uma linha por ingrediente):
NomeDoInsumo QuantidadeUnidade

Exemplo:
Vitamina C 500mg
Zinco bisglicinato 15mg
Colageno hidrolisado 300mg

IMPORTANTE:
- Mantenha o nome completo do insumo
- Inclua a quantidade e unidade (mg, mcg, g, UI, etc)
- Se houver informacoes entre parenteses, mantenha-as
- Retorne APENAS a lista, sem explicacoes
```

**Estrutura da Edge Function:**
```typescript
// Recebe: { image: string (base64) }
// Retorna: { texto: string, success: boolean }

const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { 
        role: "user", 
        content: [
          { type: "text", text: "Extraia os insumos e quantidades desta imagem:" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
  }),
});
```

#### 2. Alteracoes no ImportarDoseDialog.tsx

**Novos states:**
```typescript
const [imagemPreview, setImagemPreview] = useState<string | null>(null);
const [processandoImagem, setProcessandoImagem] = useState(false);
const [erroImagem, setErroImagem] = useState<string | null>(null);
```

**Novo elemento de UI - Botao de upload:**
```tsx
<div className="flex gap-2 mb-4">
  <Button
    type="button"
    variant="outline"
    onClick={() => fileInputRef.current?.click()}
    disabled={processandoImagem}
  >
    <ImageIcon className="h-4 w-4 mr-2" />
    Anexar Imagem
  </Button>
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleImageUpload}
  />
</div>
```

**Funcao de processamento da imagem:**
```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Mostrar preview
  const reader = new FileReader();
  reader.onload = (e) => setImagemPreview(e.target?.result as string);
  reader.readAsDataURL(file);

  // Enviar para edge function
  setProcessandoImagem(true);
  setErroImagem(null);

  try {
    // Converter para base64
    const base64 = await fileToBase64(file);
    
    const response = await supabase.functions.invoke('extract-dose-from-image', {
      body: { image: base64 }
    });

    if (response.error) throw new Error(response.error.message);
    
    // Usar o texto extraido no campo de texto existente
    setTexto(response.data.texto);
  } catch (error) {
    setErroImagem('Erro ao processar imagem. Tente novamente.');
    console.error(error);
  } finally {
    setProcessandoImagem(false);
  }
};
```

**Preview da imagem no dialog:**
```tsx
{imagemPreview && (
  <div className="relative">
    <img 
      src={imagemPreview} 
      alt="Preview" 
      className="max-h-32 rounded-md border"
    />
    <Button
      size="icon"
      variant="destructive"
      className="absolute top-1 right-1 h-6 w-6"
      onClick={() => {
        setImagemPreview(null);
        setTexto('');
      }}
    >
      <X className="h-3 w-3" />
    </Button>
  </div>
)}
```

**Indicador de processamento:**
```tsx
{processandoImagem && (
  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    <span className="text-sm text-blue-800">
      Processando imagem com IA...
    </span>
  </div>
)}
```

---

### Interface Visual Atualizada

```
+--------------------------------------------------+
|           Importar Dose Copiada              [X] |
+--------------------------------------------------+
|                                                  |
| Cole o texto ou anexe uma imagem com os insumos. |
|                                                  |
| [ Anexar Imagem ]                                |
|                                                  |
| +----------------------------------------------+ |
| |  [Preview da imagem se anexada]              | |
| +----------------------------------------------+ |
|                                                  |
| OU cole o texto abaixo:                          |
|                                                  |
| +----------------------------------------------+ |
| |                                              | |
| | [Textarea - preenchido automaticamente       | |
| |  se imagem foi processada]                   | |
| |                                              | |
| +----------------------------------------------+ |
|                                                  |
| [Processando imagem com IA...] <- se processando |
|                                                  |
| Previa dos insumos reconhecidos:                 |
| +----------------------------------------------+ |
| | ✓ Colageno hidrolisado - 300 mg              | |
| | ✓ Vitamina C - 500 mg                        | |
| +----------------------------------------------+ |
|                                                  |
|  [Limpar]                    [Cancelar] [IMPORTAR DOSE] |
+--------------------------------------------------+
```

---

### Configuracao do Lovable AI

O projeto precisara habilitar o Lovable AI para usar o gateway de IA. Isso sera feito automaticamente ao criar a edge function, e o `LOVABLE_API_KEY` estara disponivel como secret.

**Modelo escolhido:** `google/gemini-2.5-flash`
- Suporta imagens (multimodal)
- Rapido e eficiente
- Bom custo-beneficio para OCR

---

### Tratamento de Erros

1. **Imagem muito grande:** Validar tamanho antes de enviar (max 10MB)
2. **Formato nao suportado:** Aceitar apenas image/jpeg, image/png, image/webp
3. **Falha na IA:** Mostrar mensagem amigavel e permitir retry
4. **Timeout:** Configurar timeout adequado (30s)
5. **Rate limit (429):** Mostrar toast pedindo para aguardar

---

### Passos de Implementacao

1. Habilitar Lovable AI no projeto (o `LOVABLE_API_KEY` sera provisionado automaticamente)
2. Criar edge function `extract-dose-from-image`
3. Atualizar `config.toml` com a nova funcao
4. Modificar `ImportarDoseDialog.tsx` para adicionar upload de imagem
5. Testar com diferentes tipos de imagens (foto, screenshot, PDF convertido)

