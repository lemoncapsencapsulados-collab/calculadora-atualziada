import { useMemo, useState } from 'react';
import { useLeadsOrcamento, LeadOrcamento } from '@/hooks/useLeadsOrcamento';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Users, Search, MessageCircle, Calendar, Package, FileText, Pencil,
  Phone, Mail, DollarSign, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Orcamento } from '@/types/orcamento';
import GerarOrcamentoDialog from '@/components/GerarOrcamentoDialog';
import PreviewPdfDialog from '@/components/PreviewPdfDialog';
import { buildWhatsappUrl as sharedBuildWhatsappUrl, formatTelefone as sharedFormatTelefone, isTelefoneValido } from '@/lib/whatsapp';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Criado', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  pago: { label: 'Pago', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
};

const formatTelefone = sharedFormatTelefone;
function buildWhatsappUrl(telefone: string, nome: string): string | null {
  const msg = `Olá ${nome}, tudo bem? Sou da Lemon Caps e estou entrando em contato sobre seu orçamento.`;
  return sharedBuildWhatsappUrl(telefone, msg);
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LeadsOrcamento() {
  const { data: leads = [], isLoading, refetch } = useLeadsOrcamento();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');

  const [editandoOrcamento, setEditandoOrcamento] = useState<Orcamento | null>(null);
  const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null);

  const consultoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.orcamentos.forEach((o) => o.consultor_responsavel && set.add(o.consultor_responsavel)));
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return leads.filter((l) => {
      if (termo) {
        const matchNome = l.nome.toLowerCase().includes(termo);
        const matchTel = (l.telefone || '').replace(/\D/g, '').includes(termo.replace(/\D/g, ''));
        if (!matchNome && !matchTel) return false;
      }
      if (statusFilter !== 'all') {
        if (!l.orcamentos.some((o) => o.status === statusFilter)) return false;
      }
      if (consultorFilter !== 'all') {
        if (!l.orcamentos.some((o) => o.consultor_responsavel === consultorFilter)) return false;
      }
      return true;
    });
  }, [leads, searchTerm, statusFilter, consultorFilter]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                Leads Orçamento
              </CardTitle>
              <CardDescription>
                Clientes que receberam orçamentos — contato direto via WhatsApp
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm self-start">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status do orçamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Criado</SelectItem>
                                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultoresDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          {filteredLeads.length === 0 ? (
            <div className="py-12 text-center border rounded-lg bg-muted/30">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum lead encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.key}
                  lead={lead}
                  onEdit={setEditandoOrcamento}
                  onPreview={setPreviewOrcamento}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editandoOrcamento && (
        <GerarOrcamentoDialog
          orcamentoExistente={editandoOrcamento}
          onClose={() => setEditandoOrcamento(null)}
          onSuccess={() => { setEditandoOrcamento(null); refetch(); }}
        />
      )}
      {previewOrcamento && (
        <PreviewPdfDialog
          orcamento={previewOrcamento}
          onClose={() => setPreviewOrcamento(null)}
        />
      )}
    </div>
  );
}

interface LeadCardProps {
  lead: LeadOrcamento;
  onEdit: (orc: Orcamento) => void;
  onPreview: (orc: Orcamento) => void;
}

function LeadCard({ lead, onEdit, onPreview }: LeadCardProps) {
  const whatsappUrl = buildWhatsappUrl(lead.telefone, lead.nome);
  const temWhats = isTelefoneValido(lead.telefone);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Identidade do cliente */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold truncate">{lead.nome}</h3>
              <Badge variant="secondary" className="text-xs">
                {lead.total_orcamentos} orçamento{lead.total_orcamentos !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {temWhats ? formatTelefone(lead.telefone) : (
                  <span className="text-destructive">Sem WhatsApp cadastrado</span>
                )}
              </span>
              {lead.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {lead.email}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Valor acumulado</p>
                <p className="font-semibold text-sm">{formatCurrency(lead.valor_total_acumulado)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último orçamento</p>
                <p className="font-medium text-sm">{format(new Date(lead.ultimo_orcamento_em), 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consultor</p>
                <p className="font-medium text-sm truncate">{lead.consultor_recente || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status mais recente</p>
                <Badge variant={STATUS_CONFIG[lead.orcamentos[0]?.status]?.variant || 'secondary'} className="text-xs">
                  {STATUS_CONFIG[lead.orcamentos[0]?.status]?.label || lead.orcamentos[0]?.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Ação WhatsApp */}
          <div className="flex lg:flex-col gap-2 lg:items-end">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!whatsappUrl}
              onClick={() => whatsappUrl && window.open(whatsappUrl, '_blank')}
              title={whatsappUrl ? 'Abrir conversa no WhatsApp' : 'Telefone inválido'}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>

        {/* Lista de orçamentos */}
        <Accordion type="single" collapsible className="mt-3">
          <AccordionItem value="orcamentos" className="border-b-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ver {lead.total_orcamentos} orçamento{lead.total_orcamentos !== 1 ? 's' : ''}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-1">
                {lead.orcamentos.map((orc) => {
                  const itens = orc.itens_producao || [];
                  return (
                    <div
                      key={orc.id}
                      className="border rounded-lg p-3 bg-muted/20 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{orc.numero_orcamento}</span>
                            <Badge variant={STATUS_CONFIG[orc.status]?.variant || 'secondary'} className="text-xs">
                              {STATUS_CONFIG[orc.status]?.label || orc.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {(orc as any).tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(orc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {itens.length} produto{itens.length !== 1 ? 's' : ''}
                            </span>
                            {orc.consultor_responsavel && (
                              <span>Consultor: <span className="text-foreground font-medium">{orc.consultor_responsavel}</span></span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Valor total</p>
                          <p className="font-bold text-sm text-primary">{formatCurrency(Number(orc.valor_total) || 0)}</p>
                        </div>
                      </div>

                      {itens.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Produtos: </span>
                          {itens.map((it: any, i: number) =>
                            `${it.nome_produto}${it.quantidade ? ` (${it.quantidade})` : ''}`
                          ).join(' • ')}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => onPreview(orc)}>
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          Ver PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(orc)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
