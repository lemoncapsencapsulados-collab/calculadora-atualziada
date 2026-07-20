import { forwardRef } from 'react';
import { FreteCotacao, PodPlanoSelecionado } from '@/types/frete';
import { formatBRL, IMPOSTO_POD_PADRAO } from '@/lib/freteHelpers';

interface Props {
  cotacao: FreteCotacao;
  produtor: string;
  numeroOrc: string;
}

/** Card para exportação PNG da cotação de frete POD por produto. */
const CotacaoExportCard = forwardRef<HTMLDivElement, Props>(({ cotacao, produtor, numeroOrc }, ref) => {
  const selecionados = Array.isArray(cotacao.pod_planos_selecionados) && cotacao.pod_planos_selecionados.length > 0
    ? cotacao.pod_planos_selecionados
    : cotacao.pod_plano != null
      ? [{
          plano: cotacao.pod_plano,
          preco: Number(cotacao.pod_preco_por_envio || 0),
          taxa_manuseio: 0,
          margem_percentual: Number(cotacao.margem_percentual || 0),
          imposto_percentual: Number(cotacao.imposto_percentual || IMPOSTO_POD_PADRAO),
          preco_final: Number(cotacao.pod_preco_por_envio || 0),
        } as PodPlanoSelecionado]
      : [];
  const isEP = cotacao.tipo === 'estoque_proprio';
  return (
    <div ref={ref} style={{ padding: 24, background: '#fff', color: '#111', width: 720, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
        {isEP ? 'Cotação de Frete — Estoque Próprio' : 'Cotação de Frete — Print on Demand'}
      </h2>
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#555' }}>
        Produtor: <strong>{produtor}</strong> · Orçamento: <strong>{numeroOrc}</strong> · Data: <strong>{new Date(cotacao.created_at).toLocaleDateString('pt-BR')}</strong>
      </p>
      <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          <span>{cotacao.nome_produto || 'Produto'}</span>
          <span style={{ color: '#666', fontWeight: 400 }}>{cotacao.tipo_produto || '—'}</span>
        </div>
        {!isEP && (
          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#555' }}>
            Quant. Envios Mensais médio: <strong>{cotacao.pod_quantidade_envios_estimada ?? '—'}</strong>
          </p>
        )}
        {isEP ? (
          <p style={{ fontSize: 13, margin: 0 }}>
            Valor do frete: <strong>{formatBRL(cotacao.valor_frete)}</strong> · Status:{' '}
            <strong>{cotacao.status === 'confirmado' ? 'Confirmado' : 'Pendente'}</strong>
          </p>
        ) : selecionados.length === 0 ? (
          <p style={{ fontSize: 12, color: '#a15c00' }}>Sem planos.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ textAlign: 'center', padding: 8 }}>Plano (frascos)</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Preço / Envio</th>
              </tr>
            </thead>
            <tbody>
              {[...selecionados].sort((a, b) => a.plano - b.plano).map(s => (
                <tr key={s.plano} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ textAlign: 'center', padding: 8, fontWeight: 700 }}>{s.plano}</td>
                  <td style={{ textAlign: 'right', padding: 8, fontWeight: 700 }}>{formatBRL(s.preco_final)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});
CotacaoExportCard.displayName = 'CotacaoExportCard';
export default CotacaoExportCard;