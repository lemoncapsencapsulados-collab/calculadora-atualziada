
## Plano: Criar Funcionalidade "Adicionar Dose Copiada" com Parsing Inteligente

### Objetivo
Implementar botão "Adicionar Dose copiada" que abre um popup onde o usuário pode colar texto de insumos (de foto, PDF ou qualquer fonte), mesmo quando estão todos em uma linha só.

### Desafio Principal
O texto pode vir em diferentes formatos:
1. **Com quebras de linha** (fácil):
   ```
   Vitamina C 500mg
   Zinco 15 mg
   ```

2. **Tudo em uma linha** (mais complexo):
   ```
   Vitamina C 500 mg Zinco 15 mg Magnésio 200 mg
   ```

### Solução de Parsing

A lógica usará regex para encontrar padrões de "quantidade + unidade" e dividir o texto a partir desses pontos.

**Regex principal:**
```
(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|kg|mL|L|UI)\b
```

**Algoritmo:**
1. Encontrar todas as ocorrências de "número + unidade" no texto
2. Para cada ocorrência, extrair o texto ANTES como nome do insumo
3. Limpar caracteres especiais do nome (parênteses, traços, etc.)
4. Buscar correspondência no banco de insumos

**Exemplo de processamento:**
```
Input: "Colágeno hidrolisado (peptídeos de colágeno) 300 mg Zinco bisglicinato 15 mg"

Passo 1: Encontrar "300 mg" na posição 45
         Nome antes: "Colágeno hidrolisado (peptídeos de colágeno)"

Passo 2: Encontrar "15 mg" na posição 75
         Nome antes: "Zinco bisglicinato"

Resultado:
  - Colágeno hidrolisado → 300 mg
  - Zinco bisglicinato → 15 mg
```

---

### Estrutura do Componente

```text
+--------------------------------------------------+
|           Importar Dose Copiada              [X] |
+--------------------------------------------------+
|                                                  |
| Cole o texto com os insumos e quantidades.       |
| Pode ser uma linha só ou com quebras.            |
|                                                  |
| +----------------------------------------------+ |
| |                                              | |
| | [Área de texto para colar]                   | |
| |                                              | |
| +----------------------------------------------+ |
|                                                  |
| Prévia dos insumos reconhecidos:                 |
| +----------------------------------------------+ |
| | ✓ Colágeno hidrolisado - 300 mg              | |
| | ✓ Zinco bisglicinato - 15 mg                 | |
| | ⚠ Vitamina XYZ - 100 mg (não encontrado)     | |
| +----------------------------------------------+ |
|                                                  |
|              [ IMPORTAR DOSE ]                   |
+--------------------------------------------------+
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/ImportarDoseDialog.tsx` | Criar novo componente |
| `src/pages/Calculator.tsx` | Adicionar botão e integração |

---

### Detalhes Técnicos

#### 1. ImportarDoseDialog.tsx

**Interface:**
```typescript
interface ParsedItem {
  nomeOriginal: string;      // Nome como veio no texto
  nomeEncontrado?: string;   // Nome do insumo no banco (se encontrado)
  quantidade: number;
  unidade: string;
  encontrado: boolean;
  insumoMatch?: Insumo;
}
```

**Função de parsing inteligente:**
```typescript
function parseTextoInsumos(texto: string, insumos: Insumo[]): ParsedItem[] {
  // Regex para encontrar quantidade + unidade
  const regex = /(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|kg|mL|L|UI)/gi;
  const matches = [...texto.matchAll(regex)];
  
  const resultados: ParsedItem[] = [];
  let ultimaPosicao = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const posicaoMatch = match.index!;
    
    // Texto entre a última posição e esta quantidade = nome do insumo
    let nomeInsumo = texto.substring(ultimaPosicao, posicaoMatch).trim();
    
    // Limpar caracteres especiais do final
    nomeInsumo = nomeInsumo.replace(/[-–—:]\s*$/, '').trim();
    
    if (nomeInsumo) {
      const quantidade = parseFloat(match[1].replace(',', '.'));
      const unidade = match[2].toLowerCase();
      
      // Buscar no banco
      const insumoMatch = buscarInsumo(nomeInsumo, insumos);
      
      resultados.push({
        nomeOriginal: nomeInsumo,
        nomeEncontrado: insumoMatch?.nome,
        quantidade,
        unidade,
        encontrado: !!insumoMatch,
        insumoMatch
      });
    }
    
    // Atualizar posição para após "quantidade unidade"
    ultimaPosicao = posicaoMatch + match[0].length;
  }
  
  return resultados;
}
```

**Busca flexível de insumos:**
```typescript
function buscarInsumo(nome: string, insumos: Insumo[]): Insumo | undefined {
  const nomeNormalizado = nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[()®™–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 1. Busca exata
  let match = insumos.find(i => 
    i.nome.toLowerCase() === nomeNormalizado
  );
  if (match) return match;
  
  // 2. Busca por inclusão
  match = insumos.find(i => 
    i.nome.toLowerCase().includes(nomeNormalizado) ||
    nomeNormalizado.includes(i.nome.toLowerCase())
  );
  if (match) return match;
  
  // 3. Busca por primeira palavra principal
  const palavras = nomeNormalizado.split(' ').filter(p => p.length > 3);
  for (const palavra of palavras) {
    match = insumos.find(i => 
      i.nome.toLowerCase().includes(palavra)
    );
    if (match) return match;
  }
  
  return undefined;
}
```

---

#### 2. Integração no Calculator.tsx

**Adicionar imports:**
```typescript
import { ClipboardPaste } from 'lucide-react';
import ImportarDoseDialog from '@/components/ImportarDoseDialog';
```

**Adicionar state:**
```typescript
const [importDialogOpen, setImportDialogOpen] = useState(false);
```

**Adicionar botão** (acima de "Insumo"):
```tsx
<Button 
  type="button" 
  variant="outline" 
  onClick={() => setImportDialogOpen(true)}
  className="mb-4"
>
  <ClipboardPaste className="w-4 h-4 mr-2" />
  Adicionar Dose copiada
</Button>
```

**Função de importação:**
```typescript
const handleImportarDose = (parsedItems: ParsedItem[]) => {
  const novosItens = parsedItems.map((item, index) => ({
    id: Date.now().toString() + index,
    insumoNome: item.nomeEncontrado || item.nomeOriginal,
    quantidade: item.quantidade.toString(),
    unidade: item.unidade as UnitType
  }));
  
  setItems(prev => {
    // Remove itens vazios
    const semVazios = prev.filter(i => i.insumoNome.trim() !== '');
    return [...semVazios, ...novosItens];
  });
  
  setImportDialogOpen(false);
  toast.success(`${parsedItems.length} insumos importados!`);
};
```

---

### Exemplo de Uso

**Usuário cola:**
```
Colágeno hidrolisado (peptídeos de colágeno) 300 mg Metilsulfonilmetano (MSM) 150 mg Ácido ascórbico (Vitamina C) 60 mg D-Biotina 45 mcg
```

**Sistema reconhece:**
| Insumo | Quantidade | Status |
|--------|------------|--------|
| Colágeno hidrolisado | 300 mg | ✓ Encontrado |
| Metilsulfonilmetano (MSM) | 150 mg | ✓ Encontrado |
| Ácido ascórbico (Vitamina C) | 60 mg | ✓ Encontrado |
| D-Biotina | 45 mcg | ✓ Encontrado |

**Usuário clica "IMPORTAR DOSE"** → Itens são adicionados à fórmula

---

### Interface Visual do Dialog

O componente terá:
- Textarea grande para colar o texto
- Parsing em tempo real conforme digita/cola
- Lista de prévia mostrando o que foi reconhecido
- Ícones visuais: ✓ verde (encontrado) ou ⚠ amarelo (não encontrado)
- Botão "IMPORTAR DOSE" habilitado apenas quando há itens válidos
- Botão para limpar e tentar novamente
