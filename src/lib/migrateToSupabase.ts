import { supabase } from '@/integrations/supabase/client';
import { getInsumos, getEmbalagens } from './localStorage';

export async function migrateLocalDataToSupabase() {
  try {
    console.log('Iniciando migração de dados locais para o banco de dados...');

    // Migrar Matérias-Primas
    const localMPs = getInsumos();
    if (localMPs.length > 0) {
      const { data: existingMPs } = await supabase
        .from('materias_primas')
        .select('nome');

      const existingNames = new Set((existingMPs as any[])?.map(i => i.nome) || []);
      
      const mpsToMigrate = localMPs
        .filter(mp => !existingNames.has(mp.nome))
        .map(({ id, ...mp }) => ({
          nome: mp.nome,
          unidade_compra: mp.unidade_compra,
          preco_compra: mp.preco_por_unidade_compra,
          densidade: mp.densidade || null,
          fornecedor: mp.fornecedor || null,
          categoria: mp.categoria || null,
          observacoes: mp.observacoes || null,
        }));

      if (mpsToMigrate.length > 0) {
        const { error } = await supabase.from('materias_primas').insert(mpsToMigrate as any);
        if (error) throw error;
        console.log(`✅ ${mpsToMigrate.length} matérias-primas migradas`);
      } else {
        console.log('✅ Nenhuma matéria-prima nova para migrar');
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
