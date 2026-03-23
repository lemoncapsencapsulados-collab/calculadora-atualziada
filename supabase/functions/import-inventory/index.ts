import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALIASES: Record<string, string> = {
  'acido citrico': 'ácido cítrico',
  'acido lactico': 'ácido láctico',
  'agar agar': 'ágar-ágar',
  'agua purificada': 'água purificada',
};

interface MateriaPrimaImport {
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
  materias_primas: {
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

function normalizeMPName(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[%/(),.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*/g, ' ')
    .replace(/\s+(ext|extrato|soluvel)\s*/g, ' ')
    .replace(/tipo\s*2/g, 'tipo ii')
    .trim();
}

function applyAliases(normalizedName: string): { final: string; aliasUsed?: string } {
  for (const [key, value] of Object.entries(ALIASES)) {
    if (normalizedName === key) {
      return { final: value, aliasUsed: key };
    }
  }
  return { final: normalizedName };
}

function normalizeUnit(unidade_compra: string, preco_compra: number): { unidade: string; preco: number } {
  const unidade = unidade_compra.toLowerCase().trim();
  if (unidade === 'g') return { unidade: 'kg', preco: preco_compra * 1000 };
  if (unidade === 'ml') return { unidade: 'L', preco: preco_compra * 1000 };
  return { unidade: unidade_compra, preco: preco_compra };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    // Support both old and new field names
    const materiasPrimas = body.materias_primas || body.insumos;
    const embalagens = body.embalagens;

    const result: ImportResult = {
      materias_primas: { criados: 0, atualizados: 0, ignorados: 0, duplicatas_mescladas: 0, erros: [] },
      embalagens: { criados: 0, atualizados: 0, ignorados: 0, erros: [] },
    };

    // ==================== PROCESSAR MATÉRIAS-PRIMAS ====================
    if (materiasPrimas && Array.isArray(materiasPrimas)) {
      console.log(`Processando ${materiasPrimas.length} matérias-primas...`);

      const { data: existingMPs } = await supabase
        .from('materias_primas')
        .select('id, nome, normalized_name, categoria, preco_compra, observacoes');

      const existingMap = new Map();
      (existingMPs || []).forEach((mp: any) => {
        existingMap.set(mp.normalized_name, mp);
      });

      const groupedMPs = new Map<string, MateriaPrimaImport[]>();
      
      materiasPrimas.forEach((mp: MateriaPrimaImport) => {
        const normalized = normalizeMPName(mp.nome);
        const { final } = applyAliases(normalized);
        if (!groupedMPs.has(final)) groupedMPs.set(final, []);
        groupedMPs.get(final)!.push(mp);
      });

      for (const [normalizedName, items] of groupedMPs.entries()) {
        try {
          let merged: MateriaPrimaImport;
          
          if (items.length > 1) {
            result.materias_primas.duplicatas_mescladas += items.length - 1;
            merged = items.reduce((best, current) => {
              return (current.categoria?.length || 0) > (best.categoria?.length || 0) ? current : best;
            });
            merged.preco_compra = items.reduce((sum, item) => sum + item.preco_compra, 0) / items.length;
            const obs = items.map(i => i.observacoes).filter(Boolean).join('; ');
            if (obs) merged.observacoes = obs;
          } else {
            merged = items[0];
          }

          const { unidade, preco } = normalizeUnit(merged.unidade_compra, merged.preco_compra);

          const mpData = {
            nome: merged.nome,
            normalized_name: normalizedName,
            categoria: merged.categoria || null,
            unidade_compra: unidade,
            preco_compra: preco,
            densidade: merged.densidade || null,
            fornecedor: merged.fornecedor || null,
            observacoes: merged.observacoes || null,
          };

          const existing = existingMap.get(normalizedName);

          if (existing) {
            if (Math.abs(existing.preco_compra - preco) > 0.00001) {
              const { error } = await supabase.from('materias_primas').update({ preco_compra: preco }).eq('id', existing.id);
              if (error) throw error;
              result.materias_primas.atualizados++;
            } else {
              result.materias_primas.ignorados++;
            }
          } else {
            const { error } = await supabase.from('materias_primas').insert([mpData]);
            if (error) throw error;
            result.materias_primas.criados++;
          }
        } catch (error: any) {
          console.error('Erro ao processar matéria-prima:', error);
          result.materias_primas.erros.push(`${items[0].nome}: ${error.message}`);
        }
      }
    }

    // ==================== PROCESSAR EMBALAGENS ====================
    if (embalagens && Array.isArray(embalagens)) {
      console.log(`Processando ${embalagens.length} embalagens...`);

      const { data: existingEmbalagens } = await supabase
        .from('embalagens')
        .select('id, nome, preco_unitario');

      const existingEmbMap = new Map();
      (existingEmbalagens || []).forEach((emb: any) => {
        existingEmbMap.set(emb.nome.trim().toLowerCase(), emb);
      });

      for (const embalagem of embalagens) {
        try {
          const nomeLimpo = embalagem.nome.trim();
          const nomeLower = nomeLimpo.toLowerCase();

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

          const existing = existingEmbMap.get(nomeLower);

          if (existing) {
            if (Math.abs(existing.preco_unitario - embalagem.preco_unitario) > 0.00001) {
              const { error } = await supabase.from('embalagens').update({ preco_unitario: embalagem.preco_unitario }).eq('id', existing.id);
              if (error) throw error;
              result.embalagens.atualizados++;
            } else {
              result.embalagens.ignorados++;
            }
          } else {
            const { error } = await supabase.from('embalagens').insert([embalagemData]);
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

    // Return with backward-compatible field names too
    const responseData = {
      ...result,
      insumos: result.materias_primas,
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
