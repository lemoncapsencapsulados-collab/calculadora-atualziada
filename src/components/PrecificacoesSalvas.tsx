import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { usePrecificacoesPaginadas } from '@/hooks/usePrecificacoesPaginadas';
import { ConfiguracaoCustos, MargemLucro } from '@/types/precificacao';
import { validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import { formatCurrency } from '@/lib/unitConversion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Pencil, Trash2, Calendar, Package, Sparkles, FileText, ChevronLeft, ChevronRight, Eye, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import EditarPrecificacaoDialog from './EditarPrecificacaoDialog';
import GerarOrcamentoDialog from './GerarOrcamentoDialog';
import { VerFormulaDialog } from './VerFormulaDialog';
import { Formula } from '@/types/formula';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PrecificacoesSalvasProps {
  configuracaoAtiva: ConfiguracaoCustos | null;
  margens: MargemLucro[] | null;
}

interface PrecificacaoComFormula {
  id: string;
  formula_id: string | null;
  preco_venda: number;
  custo_materia_prima: number;
  custo_embalagem: number;
  custo_mao_obra_direta: number;
  custo_energia: number;
  custo_depreciacao: number;
  custo_administrativo: number;
  total_custos_producao: number;
  total_impostos: number;
  margem_lucro_percentual: number;
  margem_lucro_valor: number;
  created_at: string | null;
  formulas: {
    nome_formula: string;
    cliente: string;
    tipo_produto: string;
  } | null;
  [key: string]: unknown;
}

const PAGE_SIZE = 15;

export default function PrecificacoesSalvas({ 
  configuracaoAtiva, 
  margens 
}: PrecificacoesSalvasProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { deletarPrecificacao } = usePrecificacao();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editandoPrecificacao, setEditandoPrecificacao] = useState<PrecificacaoComFormula | null>(null);
  const [formulaParaVer, setFormulaParaVer] = useState<Formula | null>(null);

  // Duplicação
  const [duplicarPrecificacao, setDuplicarPrecificacao] = useState<PrecificacaoComFormula | null>(null);
  const [duplicarCliente, setDuplicarCliente] = useState('');
  const [duplicarFormula, setDuplicarFormula] = useState('');

  const handleEditClose = () => {
    setEditandoPrecificacao(null);
    queryClient.invalidateQueries({ queryKey: ['precificacoes-paginadas'] });
  };
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [showGerarOrcamento, setShowGerarOrcamento] = useState(false);

  const { precificacoes, totalCount, totalPages, isLoading } = usePrecificacoesPaginadas({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchTerm,
  });

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getMargemStyles = (margem: number, tipoProduto?: string) => {
    if (!tipoProduto) return { 
      color: 'text-foreground', 
      bg: 'bg-muted', 
      border: 'border-muted',
      isExcelente: false 
    };
    
    const validacao = validarMargemPorTipo(margem, tipoProduto);
    return {
      color: validacao.color,
      bg: validacao.status === 'excelente' ? 'gold-shimmer' : validacao.bgColor,
      border: validacao.borderColor,
      isExcelente: validacao.status === 'excelente',
    };
  };

  const handleConfirmDelete = async () => {
    if (deletandoId) {
      await deletarPrecificacao.mutateAsync(deletandoId);
      setDeletandoId(null);
      queryClient.invalidateQueries({ queryKey: ['precificacoes-paginadas'] });
    }
  };

  const handleVerFormula = async (formulaId: string | null) => {
    if (!formulaId) return;
    const { data, error } = await supabase
      .from('formulas')
      .select('*')
      .eq('id', formulaId)
      .maybeSingle();
    if (error || !data) {
      toast.error('Fórmula não encontrada');
      return;
    }
    setFormulaParaVer({
      id: data.id,
      cliente: data.cliente,
      nome_formula: data.nome_formula,
      tipo_produto: data.tipo_produto as any,
      quantidade_por_pote: data.quantidade_por_pote,
      unidades_por_dose: data.unidades_por_dose,
      unidade_soluvel: data.unidade_soluvel as any,
      itens: data.itens as any,
      embalagens: data.embalagens as any,
      total_mp: data.total_mp,
      total_embalagem: data.total_embalagem,
      custo_total: data.custo_total,
      data: new Date(data.created_at!),
    });
  };

  const handleDuplicar = async () => {
    if (!duplicarPrecificacao || !duplicarCliente.trim() || !duplicarFormula.trim()) {
      toast.error('Preencha o nome do cliente e da fórmula');
      return;
    }
    try {
      // Buscar fórmula original
      const { data: formulaOriginal, error: fetchErr } = await supabase
        .from('formulas')
        .select('*')
        .eq('id', duplicarPrecificacao.formula_id!)
        .single();
      if (fetchErr || !formulaOriginal) throw new Error('Fórmula original não encontrada');

      // Duplicar fórmula
      const { data: novaFormula, error: insertErr } = await supabase
        .from('formulas')
        .insert({
          cliente: duplicarCliente.trim(),
          nome_formula: duplicarFormula.trim(),
          tipo_produto: formulaOriginal.tipo_produto,
          quantidade_por_pote: formulaOriginal.quantidade_por_pote,
          itens: formulaOriginal.itens,
          embalagens: formulaOriginal.embalagens,
          total_mp: formulaOriginal.total_mp,
          total_embalagem: formulaOriginal.total_embalagem,
          custo_total: formulaOriginal.custo_total,
          unidades_por_dose: formulaOriginal.unidades_por_dose,
          unidade_soluvel: formulaOriginal.unidade_soluvel,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Duplicar precificação com nova fórmula
      const { id, created_at, updated_at, formulas: _, formula_id, ...precData } = duplicarPrecificacao;
      await supabase
        .from('precificacoes')
        .insert({
          ...precData,
          formula_id: novaFormula.id,
        } as any);

      toast.success('Produto precificado duplicado com sucesso!');
      setDuplicarPrecificacao(null);
      queryClient.invalidateQueries({ queryKey: ['precificacoes-paginadas'] });
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
    } catch (err: any) {
      toast.error('Erro ao duplicar: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando precificações...</p>
      </div>
    );
  }

  const typedPrecificacoes = precificacoes as PrecificacaoComFormula[];

  return (
    <div className="space-y-6">
      {/* Header com Busca e Botão Gerar Orçamento */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar por cliente ou fórmula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowGerarOrcamento(true)}>
          <FileText className="w-4 h-4 mr-2" />
          Gerar Orçamento
        </Button>
      </div>

      {/* Lista de Precificações */}
      {typedPrecificacoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Nenhuma precificação encontrada.' : 'Nenhuma precificação salva ainda.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {typedPrecificacoes.map((precificacao) => (
            <Card key={precificacao.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 p-4">
                  {/* Informações da Fórmula */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">
                          {precificacao.formulas?.nome_formula || 'Fórmula não encontrada'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {precificacao.formulas?.cliente}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {precificacao.formulas?.tipo_produto}
                      </Badge>
                    </div>

                    {/* Data */}
                    {precificacao.created_at && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(precificacao.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}

                    {/* Valores em Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Custo Produção</p>
                        <p className="font-medium">R$ {Number(precificacao.total_custos_producao).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Impostos</p>
                        <p className="font-medium">R$ {Number(precificacao.total_impostos).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Preço de Venda</p>
                        <p className="font-bold text-primary text-lg">R$ {Number(precificacao.preco_venda).toFixed(2)}</p>
                      </div>
                      {(() => {
                        const styles = getMargemStyles(
                          Number(precificacao.margem_lucro_percentual),
                          precificacao.formulas?.tipo_produto
                        );
                        return (
                          <div className={`relative p-2 rounded-lg border overflow-hidden ${styles.bg} ${styles.border}`}>
                            {styles.isExcelente && (
                              <Sparkles className="absolute top-1 right-1 w-3 h-3 text-amber-400 sparkle" />
                            )}
                            <p className="text-muted-foreground text-xs">Margem de Lucro</p>
                            <div className="flex items-baseline gap-2">
                              <span className={`font-bold text-lg ${styles.color}`}>
                                {Number(precificacao.margem_lucro_percentual).toFixed(1)}%
                              </span>
                              <span className={`text-sm ${styles.color}`}>
                                (R$ {Number(precificacao.margem_lucro_valor).toFixed(2)})
                              </span>
                            </div>
                            {styles.isExcelente && (
                              <p className="text-xs font-bold text-amber-600 animate-pulse mt-1">LEMON RICA!</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex md:flex-col gap-2 justify-end md:justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerFormula(precificacao.formula_id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Fórmula
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditandoPrecificacao(precificacao)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDuplicarPrecificacao(precificacao);
                        setDuplicarCliente(precificacao.formulas?.cliente || '');
                        setDuplicarFormula(precificacao.formulas?.nome_formula || '');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setDeletandoId(precificacao.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {totalCount} resultado{totalCount !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog de Edição */}
      {editandoPrecificacao && (
        <EditarPrecificacaoDialog
          precificacao={editandoPrecificacao}
          configuracaoAtiva={configuracaoAtiva}
          margens={margens}
          onClose={handleEditClose}
        />
      )}

      {/* Dialog de Gerar Orçamento */}
      {showGerarOrcamento && (
        <GerarOrcamentoDialog
          onClose={() => setShowGerarOrcamento(false)}
          onSuccess={() => navigate('/orcamentos')}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletandoId} onOpenChange={(open) => !open && setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta precificação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
