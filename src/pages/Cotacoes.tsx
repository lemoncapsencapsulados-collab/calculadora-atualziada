import { useState, useMemo } from 'react';
import { useFormulas } from '@/hooks/useFormulas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/unitConversion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, FileText, Trash2, Download, Calculator as CalcIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { GerarPedidoDialog } from '@/components/GerarPedidoDialog';
import { usePedidos } from '@/hooks/usePedidos';
import { gerarPDFOrdemProducao } from '@/lib/pdfGenerator';
import { Pedido, Formula } from '@/types/formula';
import { VerFormulaDialog } from '@/components/VerFormulaDialog';

const Cotacoes = () => {
  const { formulas, loading, deleteFormula, updateFormula } = useFormulas();
  const { createPedido } = usePedidos();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const navigate = useNavigate();

  const handleGerarPedido = async (formula: any, dados: any) => {
    const numeroPedido = `OP-${format(new Date(), 'yyyyMMddHHmmss')}`;
    
    const novoPedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'> = {
      formula_id: formula.id,
      numero_pedido: numeroPedido,
      data_pedido: dados.data_pedido,
      data_entrega: dados.data_entrega,
      quantidade_produto: dados.quantidade_produto,
      unidade_produto: dados.unidade_produto,
      status: 'aguardando_producao',
      formula_snapshot: formula,
      observacoes: dados.observacoes,
    };

    try {
      await createPedido(novoPedido);
      
      gerarPDFOrdemProducao({
        ...novoPedido,
        id: numeroPedido,
        created_at: new Date(),
        updated_at: new Date(),
      } as Pedido);
    } catch (error) {
      console.error('Erro ao gerar pedido:', error);
    }
  };


  const filteredFormulas = useMemo(() => {
    return formulas.filter((formula) => {
      const matchesSearch =
        formula.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formula.nome_formula.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTipo = filterTipo === 'Todos' || formula.tipo_produto === filterTipo;

      return matchesSearch && matchesTipo;
    });
  }, [formulas, searchTerm, filterTipo]);

  const handleExport = (formula: any) => {
    let csv = `COTAÇÃO - ${formula.nome_formula}\n`;
    csv += `Cliente: ${formula.cliente}\n`;
    csv += `Data: ${format(new Date(formula.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}\n`;
    csv += `Tipo: ${formula.tipo_produto}\n`;
    csv += `Quantidade: ${formula.quantidade_por_pote}\n\n`;

    csv += 'MATÉRIA-PRIMA\n';
    csv += 'Matéria-Prima,Quantidade,Unidade,Custo\n';
    formula.itens.forEach((item: any) => {
      csv += `${item.nome_insumo_snapshot},${item.qtd_informada},${item.unidade_informada},${formatCurrency(item.custo_calculado)}\n`;
    });
    csv += `TOTAL MP,,,${formatCurrency(formula.total_mp)}\n\n`;

    csv += 'EMBALAGEM\n';
    csv += 'Item,Descrição,Custo\n';
    formula.embalagens.forEach((item: any) => {
      csv += `${item.descricao_snapshot},,${formatCurrency(item.custo_calculado)}\n`;
    });
    csv += `TOTAL EMBALAGEM,,${formatCurrency(formula.total_embalagem)}\n\n`;

    csv += `CUSTO TOTAL,,${formatCurrency(formula.custo_total)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cotacao_${formula.cliente}_${formula.nome_formula}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadToCalculator = (formula: any) => {
    // Salvar dados no localStorage para carregar no calculador
    localStorage.setItem('loadFormula', JSON.stringify(formula));
    navigate('/');
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'Encapsulados':
        return 'default';
      case 'Solúvel':
        return 'secondary';
      case 'Gummy':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando cotações...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Cotações Salvas
          </CardTitle>
          <CardDescription>
            Gerencie e visualize todas as suas cotações salvas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou fórmula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {['Todos', 'Encapsulados', 'Solúvel', 'Gummy', 'Líquido'].map((tipo) => (
              <Button
                key={tipo}
                variant={filterTipo === tipo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterTipo(tipo)}
              >
                {tipo}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cotações */}
      <div className="space-y-4">
        {filteredFormulas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm || filterTipo !== 'Todos'
                ? 'Nenhuma cotação encontrada com os filtros aplicados.'
                : 'Nenhuma cotação salva ainda. Crie uma no Calculador!'}
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {filteredFormulas.map((formula) => (
              <AccordionItem key={formula.id} value={formula.id} className="border rounded-lg">
                <Card>
                  <AccordionTrigger className="hover:no-underline px-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formula.cliente}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{formula.nome_formula}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getTipoBadgeVariant(formula.tipo_produto)}>
                            {formula.tipo_produto}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formula.tipo_produto === 'Solúvel' 
                              ? `${formula.unidade_soluvel === 'g' ? (formula.quantidade_por_pote / 1000).toFixed(0) : formula.quantidade_por_pote} ${formula.unidade_soluvel || 'mg'}`
                              : formula.tipo_produto === 'Encapsulados'
                              ? `${formula.quantidade_por_pote} cápsulas`
                              : formula.tipo_produto === 'Gummy'
                              ? `${formula.quantidade_por_pote} gummies`
                              : formula.tipo_produto === 'Líquido'
                              ? `${formula.quantidade_por_pote} mL`
                              : `${formula.quantidade_por_pote} pote(s)`}
                          </span>
                          {formula.unidades_por_dose && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {Math.floor(formula.quantidade_por_pote / formula.unidades_por_dose)} doses
                              </span>
                            </>
                          )}
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(formula.data), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-primary">
                        {formatCurrency(formula.custo_total)}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <CardContent className="space-y-6 pt-4">
                      {/* Informações de Dosagem */}
                      {formula.unidades_por_dose && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Informações de Dosagem</h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Unidades por dose:</p>
                              <p className="font-medium">
                                {formula.tipo_produto === 'Pó' && formula.unidade_po === 'g'
                                  ? `${(formula.unidades_por_dose / 1000).toFixed(1)} g`
                                  : formula.tipo_produto === 'Pó'
                                  ? `${formula.unidades_por_dose} mg`
                                  : formula.tipo_produto === 'Encapsulados' 
                                  ? `${formula.unidades_por_dose} cápsulas`
                                  : formula.tipo_produto === 'Gummy' 
                                  ? `${formula.unidades_por_dose} gummies`
                                  : formula.tipo_produto === 'Líquido' 
                                  ? `${formula.unidades_por_dose} mL`
                                  : `${formula.unidades_por_dose} g`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Número de doses:</p>
                              <p className="font-medium">
                                {Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Matéria-Prima */}
                      <div>
                        <h4 className="font-semibold mb-2">Matéria-Prima</h4>
                        <div className="space-y-2">
                          {formula.itens.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {item.nome_insumo_snapshot} ({item.qtd_informada} {item.unidade_informada})
                              </span>
                              <span>{formatCurrency(item.custo_calculado)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-semibold pt-2 border-t">
                            <span>Total MP:</span>
                            <span>{formatCurrency(formula.total_mp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Embalagens */}
                      <div>
                        <h4 className="font-semibold mb-2">Embalagens</h4>
                        <div className="space-y-2">
                          {formula.embalagens.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.descricao_snapshot}</span>
                              <span>{formatCurrency(item.custo_calculado)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-semibold pt-2 border-t">
                            <span>Total Embalagem:</span>
                            <span>{formatCurrency(formula.total_embalagem)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 flex-wrap pt-4 border-t">
                        <VerFormulaDialog 
                          formula={formula as Formula} 
                          onUpdateFormula={updateFormula}
                        />
                        <GerarPedidoDialog 
                          formula={formula} 
                          onConfirm={(dados) => handleGerarPedido(formula, dados)} 
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadToCalculator(formula)}
                        >
                          <CalcIcon className="h-4 w-4 mr-2" />
                          Carregar no Calculador
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExport(formula)}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar CSV
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a cotação "{formula.nome_formula}" do
                                cliente {formula.cliente}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteFormula(formula.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
};

export default Cotacoes;
