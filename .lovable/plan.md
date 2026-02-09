

## Plano: Ocultar "Amido de Milho" em todo o sistema

### Objetivo

Remover todas as referencias visíveis a "Amido de Milho" em toda a aplicacao, substituindo por apenas "Excipiente". O insumo continua funcionando internamente da mesma forma, mas nenhum usuario ou cliente vera o nome real.

---

### Arquivos a Modificar

#### 1. `src/pages/Calculator.tsx` (principal - 6 alteracoes)

| Local | De | Para |
|-------|-----|------|
| Comentario linha ~236 | "Amido de Milho necessário" | "Excipiente necessário" |
| Comentario linha ~282 | "Buscar o Amido de Milho no banco" | "Buscar o excipiente no banco" |
| Console.warn linha ~297 | "Amido de Milho nao encontrado" | "Excipiente nao encontrado" |
| Debug log linha ~293 | "amidoEncontrado", "nomeAmido" | "excipienteEncontrado" |
| UI linha ~978 | "Excipiente Necessário (Amido de Milho):" | "Excipiente Necessário:" |
| UI linha ~1107 | "Detalhamento do Excipiente (Amido de Milho)" | "Detalhamento do Excipiente" |
| Comentario linha ~1102 | "(Amido de Milho)" | removido |
| Snapshot nome linha ~463 | `${calcularExcipiente.insumo.nome} (Excipiente)` | `Excipiente` |

A linha 463 e critica: quando a formula e salva, o `nome_insumo_snapshot` registra o nome. Mudar para apenas "Excipiente" garante que em PDFs de propostas e orcamentos, o nome "Amido de Milho" nunca apareca.

#### 2. `src/lib/localStorage.ts` (1 alteracao)

| Local | De | Para |
|-------|-----|------|
| Dados iniciais linha ~143 | `nome: 'Amido de Milho'` | `nome: 'Excipiente'` |

Isso afeta apenas dados iniciais de fallback. O banco de dados real tambem precisara ser atualizado.

#### 3. Banco de Dados - Atualizar nome do insumo

Executar update no registro existente do inventario para renomear "Amido de Milho" para "Excipiente", garantindo que a busca no Calculator continue funcionando.

---

### Logica de Busca do Excipiente (Adaptacao)

A busca atual no Calculator usa:
```typescript
insumos.find(i => i.nome.toLowerCase().includes('amido') && i.nome.toLowerCase().includes('milho'))
```

Sera alterada para:
```typescript
insumos.find(i => i.nome.toLowerCase().includes('excipiente'))
```

Isso garante que o sistema encontra o insumo pelo novo nome.

---

### PDFs (Propostas e Orcamentos)

Os PDFs ja usam os dados salvos (`nome_insumo_snapshot` e `insumos_formula[].nome`). Com a alteracao no snapshot (item 1, linha 463), novas formulas salvas ja mostrarao apenas "Excipiente" nos PDFs automaticamente.

Para formulas ja salvas anteriormente que contenham "Amido de Milho" no snapshot, os geradores de PDF (`propostaGenerator.ts` e `orcamentoGenerator.ts`) receberao um filtro que substitui qualquer texto contendo "Amido de Milho" por "Excipiente" antes de renderizar.

---

### Resumo das Mudancas

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/Calculator.tsx` | ~8 substituicoes (UI, comentarios, logica de busca, snapshot) |
| `src/lib/localStorage.ts` | 1 substituicao (dados iniciais) |
| `src/lib/propostaGenerator.ts` | 1 filtro para sanitizar nomes antes do PDF |
| `src/lib/orcamentoGenerator.ts` | 1 filtro para sanitizar nomes antes do PDF |
| Banco de dados | UPDATE no insumo para renomear |

