import { supabase } from '@/integrations/supabase/client';
import { getInsumos, getEmbalagens } from './localStorage';

export async function migrateLocalDataToSupabase() {
  try {
    console.log('Iniciando migração de dados locais para o banco de dados...');

    // Migrar Insumos
    const localInsumos = getInsumos();
    if (localInsumos.length > 0) {
      const { data: existingInsumos } = await supabase
        .from('insumos')
        .select('nome');

      const existingNames = new Set(existingInsumos?.map(i => i.nome) || []);
      
      const insumosToMigrate = localInsumos
        .filter(insumo => !existingNames.has(insumo.nome))
        .map(({ id, ...insumo }) => ({
          nome: insumo.nome,
          unidade_compra: insumo.unidade_compra,
          preco_compra: insumo.preco_por_unidade_compra,
          densidade: insumo.densidade || null,
          fornecedor: insumo.fornecedor || null,
          categoria: insumo.categoria || null,
          observacoes: insumo.observacoes || null,
        }));

      if (insumosToMigrate.length > 0) {
        const { error } = await supabase.from('insumos').insert(insumosToMigrate);
        if (error) throw error;
        console.log(`✅ ${insumosToMigrate.length} insumos migrados`);
      } else {
        console.log('✅ Nenhum insumo novo para migrar');
      }
    }

    // Migrar Embalagens
    const localEmbalagens = getEmbalagens();
    if (localEmbalagens.length > 0) {
      const { data: existingEmbalagens } = await supabase
        .from('embalagens')
        .select('nome');

      const existingNames = new Set(existingEmbalagens?.map(e => e.nome) || []);
      
      const embalagensToMigrate = localEmbalagens
        .filter(embalagem => !existingNames.has(embalagem.nome))
        .map(({ id, ...embalagem }) => ({
          nome: embalagem.nome,
          descricao: embalagem.descricao,
          preco_unitario: embalagem.preco_unitario,
        }));

      if (embalagensToMigrate.length > 0) {
        const { error } = await supabase.from('embalagens').insert(embalagensToMigrate);
        if (error) throw error;
        console.log(`✅ ${embalagensToMigrate.length} embalagens migradas`);
      } else {
        console.log('✅ Nenhuma embalagem nova para migrar');
      }
    }

    console.log('✅ Migração concluída com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    return false;
  }
}
