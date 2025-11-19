import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Aliases para normalização de nomes
const ALIASES: Record<string, string> = {
  'acido citrico': 'ácido cítrico',
  'acido lactico': 'ácido láctico',
  'agar agar': 'ágar-ágar',
  'agua purificada': 'água purificada',
};

interface InsumoImport {
  id?: string;
  nome: string;
  categoria?: string;
  unidade_compra: string;
  preco_compra: number;
  densidade?: number;
  fornecedor?: string;
  observacoes?: string;
}

interface EmbalagemImport {
  id?: string;
  nome: string;
  descricao: string;
  categoria?: string;
  subcategoria?: string;
  preco_unitario: number;
}

interface ImportResult {
  insumos: {
    criados: number;
    atualizados: number;
    ignorados: number;
    duplicatas_mescladas: number;
    erros: string[];
  };
  embalagens: {
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: string[];
  };
}

// Normalizar nome de insumo (usa a função do banco)
function normalizeInsumoName(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[%/(),.-]/g, ' ') // substitui caracteres especiais por espaço
    .replace(/\s+/g, ' ') // remove múltiplos espaços
    .replace(/\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*/g, ' ')
    .replace(/\s+(ext|extrato|soluvel)\s*/g, ' ')
    .replace(/tipo\s*2/g, 'tipo ii')
    .trim();
}

// Aplicar aliases
function applyAliases(normalizedName: string): { final: string; aliasUsed?: string } {
  for (const [key, value] of Object.entries(ALIASES)) {
    if (normalizedName === key) {
      return { final: value, aliasUsed: key };
    }
  }
  return { final: normalizedName };
}

// Converter unidade e preço
function normalizeUnit(unidade_compra: string, preco_compra: number): { unidade: string; preco: number } {
  const unidade = unidade_compra.toLowerCase().trim();
  
  // Converter g → kg
  if (unidade === 'g') {
    return { unidade: 'kg', preco: preco_compra * 1000 };
  }
  
  // Converter mL → L
  if (unidade === 'ml') {
    return { unidade: 'L', preco: preco_compra * 1000 };
  }
  
  // Manter outras unidades
  return { unidade: unidade_compra, preco: preco_compra };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { insumos, embalagens } = await req.json();

    const result: ImportResult = {
      insumos: {
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        duplicatas_mescladas: 0,
        erros: [],
      },
      embalagens: {
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        erros: [],
      },
    };

    // ==================== PROCESSAR INSUMOS ====================
    if (insumos && Array.isArray(insumos)) {
      console.log(`Processando ${insumos.length} insumos...`);

      // Buscar insumos existentes
      const { data: existingInsumos } = await supabase
        .from('insumos')
        .select('id, nome, normalized_name, categoria, preco_compra, observacoes');

      const existingMap = new Map();
      (existingInsumos || []).forEach((ins: any) => {
        existingMap.set(ins.normalized_name, ins);
      });

      // Agrupar por nome normalizado para detectar duplicatas no JSON
      const groupedInsumos = new Map<string, InsumoImport[]>();
      
      insumos.forEach((insumo: InsumoImport) => {
        const normalized = normalizeInsumoName(insumo.nome);
        const { final } = applyAliases(normalized);
        
        if (!groupedInsumos.has(final)) {
          groupedInsumos.set(final, []);
        }
        groupedInsumos.get(final)!.push(insumo);
      });

      // Processar cada grupo
      for (const [normalizedName, items] of groupedInsumos.entries()) {
        try {
          // Mesclar duplicatas do JSON
          let merged: InsumoImport;
          
          if (items.length > 1) {
            console.log(`Mesclando ${items.length} duplicatas: ${items.map(i => i.nome).join(', ')}`);
            result.insumos.duplicatas_mescladas += items.length - 1;
            
            // Escolher o item com categoria mais específica
            merged = items.reduce((best, current) => {
              const bestCatLength = best.categoria?.length || 0;
              const currentCatLength = current.categoria?.length || 0;
              return currentCatLength > bestCatLength ? current : best;
            });
            
            // Média de preços
            const avgPreco = items.reduce((sum, item) => sum + item.preco_compra, 0) / items.length;
            merged.preco_compra = avgPreco;
            
            // Mesclar observações
            const observacoes = items
              .map(i => i.observacoes)
              .filter(Boolean)
              .join('; ');
            if (observacoes) {
              merged.observacoes = observacoes;
            }
          } else {
            merged = items[0];
          }

          // Normalizar unidade e preço
          const { unidade, preco } = normalizeUnit(merged.unidade_compra, merged.preco_compra);

          const insumoData = {
            nome: merged.nome,
            normalized_name: normalizedName,
            categoria: merged.categoria || null,
            unidade_compra: unidade,
            preco_compra: preco,
            densidade: merged.densidade || null,
            fornecedor: merged.fornecedor || null,
            observacoes: merged.observacoes || null,
          };

          // Verificar se já existe
          const existing = existingMap.get(normalizedName);

          if (existing) {
            // Atualizar preço se diferente
            if (Math.abs(existing.preco_compra - preco) > 0.01) {
              const { error } = await supabase
                .from('insumos')
                .update({ preco_compra: preco })
                .eq('id', existing.id);

              if (error) throw error;
              result.insumos.atualizados++;
            } else {
              result.insumos.ignorados++;
            }
          } else {
            // Criar novo
            const { error } = await supabase
              .from('insumos')
              .insert([insumoData]);

            if (error) throw error;
            result.insumos.criados++;
          }
        } catch (error: any) {
          console.error('Erro ao processar insumo:', error);
          result.insumos.erros.push(`${items[0].nome}: ${error.message}`);
        }
      }
    }

    // ==================== PROCESSAR EMBALAGENS ====================
    if (embalagens && Array.isArray(embalagens)) {
      console.log(`Processando ${embalagens.length} embalagens...`);

      // Buscar embalagens existentes
      const { data: existingEmbalagens } = await supabase
        .from('embalagens')
        .select('id, nome, preco_unitario');

      const existingEmbMap = new Map();
      (existingEmbalagens || []).forEach((emb: any) => {
        existingEmbMap.set(emb.nome.trim().toLowerCase(), emb);
      });

      for (const embalagem of embalagens) {
        try {
          // Limpar nome
          const nomeLimpo = embalagem.nome.trim();
          const nomeLower = nomeLimpo.toLowerCase();

          // Validar preço
          if (!embalagem.preco_unitario || embalagem.preco_unitario <= 0) {
            result.embalagens.erros.push(`${nomeLimpo}: preço inválido`);
            continue;
          }

          const embalagemData = {
            nome: nomeLimpo,
            descricao: embalagem.descricao || '',
            categoria: embalagem.categoria || null,
            subcategoria: embalagem.subcategoria || null,
            preco_unitario: embalagem.preco_unitario,
          };

          // Verificar se já existe
          const existing = existingEmbMap.get(nomeLower);

          if (existing) {
            // Atualizar preço se diferente
            if (Math.abs(existing.preco_unitario - embalagem.preco_unitario) > 0.01) {
              const { error } = await supabase
                .from('embalagens')
                .update({ preco_unitario: embalagem.preco_unitario })
                .eq('id', existing.id);

              if (error) throw error;
              result.embalagens.atualizados++;
            } else {
              result.embalagens.ignorados++;
            }
          } else {
            // Criar nova
            const { error } = await supabase
              .from('embalagens')
              .insert([embalagemData]);

            if (error) throw error;
            result.embalagens.criados++;
          }
        } catch (error: any) {
          console.error('Erro ao processar embalagem:', error);
          result.embalagens.erros.push(`${embalagem.nome}: ${error.message}`);
        }
      }
    }

    console.log('Importação concluída:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
