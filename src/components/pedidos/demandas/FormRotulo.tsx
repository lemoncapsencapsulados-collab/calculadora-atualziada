import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, FileDown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ArquivoDemanda, DadosRotulo, ESTRUTURAS_ROTULO, POSICIONAMENTOS,
  LOCAIS_PRODUCAO, minimoRotulos, ProdutoPedido, ProdutoRotulo, SEGMENTOS, TIPOS_PAPEL, TIPOS_PRODUTO,
} from '@/types/demandaMarca';
import { baixarArquivoDemanda, removerArquivoDemanda, uploadArquivoDemanda } from '@/hooks/useDemandasMarca';
import { ResumoProdutoLinha } from './ProdutosPedidoResumo';

export type { ProdutoPedido };

interface Props {
  pedidoId: string;
  produtosPedido: ProdutoPedido[];
  valorInicial?: DadosRotulo;
  arquivosIniciais?: ArquivoDemanda[];
  salvando?: boolean;
  onCancelar: () => void;
  onSalvar: (dados: DadosRotulo, arquivos: ArquivoDemanda[]) => void;
}

const novoProduto = (): ProdutoRotulo => ({
  tipo_produto: 'Encapsulado',
  nome_produto: '',
  nome_indefinido: false,
  quantidade_potes: 0,
  segmento: '',
  orcamento_qtd_rotulos: 0,
  locais_producao: [],
});

const FormRotulo = ({
  pedidoId, produtosPedido, valorInicial, arquivosIniciais, salvando, onCancelar, onSalvar,
}: Props) => {
  const [dados, setDados] = useState<DadosRotulo>(() => {
    if (valorInicial) {
      // Compatibilidade: demandas antigas guardavam esses campos no nível global
      return {
        ...valorInicial,
        produtos: (valorInicial.produtos || []).map((p) => ({
          ...p,
          orcamento_qtd_rotulos:
            p.orcamento_qtd_rotulos ?? valorInicial.orcamento_qtd_rotulos ?? minimoRotulos(p.quantidade_potes),
          locais_producao: p.locais_producao ?? valorInicial.locais_producao ?? [],
        })),
      };
    }
    return {
      tipo_papel: '',
      nome_marca: '',
      sem_marca: false,
      posicionamento: '',
      estrutura: '',
      produtos: produtosPedido.length
        ? produtosPedido.map((p) => ({
            tipo_produto: p.tipo_produto,
            nome_produto: p.nome_produto,
            nome_indefinido: false,
            quantidade_potes: p.quantidade,
            segmento: p.segmento || '',
            orcamento_qtd_rotulos: minimoRotulos(p.quantidade),
            locais_producao: [] as string[],
          }))
        : [novoProduto()],
      observacoes: '',
    };
  });
  const [arquivos, setArquivos] = useState<ArquivoDemanda[]>(arquivosIniciais ?? []);
  const [enviando, setEnviando] = useState(false);

  const infoProduto = (nome: string) => produtosPedido.find((x) => x.nome_produto === nome);

  const setProduto = (idx: number, patch: Partial<ProdutoRotulo>) => {
    setDados((d) => ({
      ...d,
      produtos: d.produtos.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  };

  const upload = async (categoria: ArquivoDemanda['categoria'], files: FileList | null) => {
    if (!files?.length) return;
    setEnviando(true);
    try {
      const novos: ArquivoDemanda[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: arquivo maior que 20MB.`);
          continue;
        }
        novos.push(await uploadArquivoDemanda(pedidoId, categoria, file));
      }
      setArquivos((prev) => [...prev, ...novos]);
      if (novos.length) toast.success('Arquivo(s) enviado(s)');
    } catch (e: any) {
      toast.error('Erro no upload: ' + (e?.message || String(e)));
    } finally {
      setEnviando(false);
    }
  };

  const removerArquivo = async (a: ArquivoDemanda) => {
    await removerArquivoDemanda(a.path);
    setArquivos((prev) => prev.filter((x) => x.path !== a.path));
  };

  const submeter = () => {
    if (!dados.tipo_papel) return toast.error('Selecione o tipo de papel.');
    if (!dados.sem_marca && !dados.nome_marca.trim()) return toast.error('Informe o nome da marca ou marque "Sem marca ainda".');
    if (!dados.posicionamento) return toast.error('Selecione o posicionamento da marca.');
    if (!dados.estrutura) return toast.error('Selecione a estrutura do rótulo.');
    if (!dados.produtos.length) return toast.error('Adicione ao menos um produto.');
    for (const [i, p] of dados.produtos.entries()) {
      const rotulo = p.nome_indefinido || !p.nome_produto ? `Produto ${i + 1}` : p.nome_produto;
      if (!p.nome_indefinido && !p.nome_produto.trim()) return toast.error('Informe o nome de cada produto ou marque "Nome indefinido".');
      if (!p.segmento) return toast.error('Selecione o segmento de cada produto.');
      if (!p.quantidade_potes || p.quantidade_potes <= 0) return toast.error('Informe a quantidade de potes de cada produto.');
      const minimo = minimoRotulos(p.quantidade_potes);
      if (!p.orcamento_qtd_rotulos || p.orcamento_qtd_rotulos <= 0)
        return toast.error(`${rotulo}: informe o orçamento de rótulos comprados (mínimo ${minimo}).`);
      if (p.orcamento_qtd_rotulos < minimo)
        return toast.error(`${rotulo}: o orçamento de rótulos precisa ser de no mínimo ${minimo} (50% a mais que ${p.quantidade_potes} potes vendidos).`);
      if (!p.locais_producao?.length)
        return toast.error(`${rotulo}: selecione ao menos um local de produção considerado no orçamento.`);
    }
    onSalvar(dados, arquivos);
  };

  const renderArquivos = (categoria: ArquivoDemanda['categoria']) => (
    <div className="space-y-1 mt-2">
      {arquivos.filter((a) => a.categoria === categoria).map((a) => (
        <div key={a.path} className="flex items-center gap-2 text-xs border rounded px-2 py-1">
          <span className="flex-1 truncate">{a.nome}</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => baixarArquivoDemanda(a)}>
            <FileDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removerArquivo(a)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Tipo de papel *</Label>
          <Select value={dados.tipo_papel} onValueChange={(v) => setDados({ ...dados, tipo_papel: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {TIPOS_PAPEL.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Posicionamento da marca *</Label>
          <Select value={dados.posicionamento} onValueChange={(v) => setDados({ ...dados, posicionamento: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {POSICIONAMENTOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Nome da marca *</Label>
          <Input
            value={dados.nome_marca}
            disabled={dados.sem_marca}
            placeholder="Nome da marca existente"
            onChange={(e) => setDados({ ...dados, nome_marca: e.target.value })}
          />
          <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
            <Checkbox
              checked={dados.sem_marca}
              onCheckedChange={(v) => setDados({ ...dados, sem_marca: !!v, nome_marca: v ? '' : dados.nome_marca })}
            />
            Sem marca ainda
          </label>
        </div>
        <div>
          <Label className="text-xs">Estrutura do rótulo *</Label>
          <Select value={dados.estrutura} onValueChange={(v) => setDados({ ...dados, estrutura: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESTRUTURAS_ROTULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Produtos do rótulo *</Label>
          <Button variant="outline" size="sm" onClick={() => setDados({ ...dados, produtos: [...dados.produtos, novoProduto()] })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar produto
          </Button>
        </div>
        <div className="space-y-3">
          {dados.produtos.map((p, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Produto {idx + 1}</span>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                  onClick={() => setDados({ ...dados, produtos: dados.produtos.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ResumoProdutoLinha produto={infoProduto(p.nome_produto)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Tipo de produto</Label>
                  <Select value={p.tipo_produto} onValueChange={(v) => setProduto(idx, { tipo_produto: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_PRODUTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Quantidade de Potes Vendidos</Label>
                  <Input
                    type="number" min={0} value={p.quantidade_potes || ''}
                    onChange={(e) => {
                      const potes = Number(e.target.value) || 0;
                      const minAnterior = minimoRotulos(p.quantidade_potes);
                      const ajustar =
                        !p.orcamento_qtd_rotulos || p.orcamento_qtd_rotulos === minAnterior;
                      setProduto(idx, {
                        quantidade_potes: potes,
                        ...(ajustar ? { orcamento_qtd_rotulos: minimoRotulos(potes) } : {}),
                      });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome do produto</Label>
                  <Input
                    value={p.nome_produto}
                    disabled={p.nome_indefinido}
                    onChange={(e) => setProduto(idx, { nome_produto: e.target.value })}
                  />
                  <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={p.nome_indefinido}
                      onCheckedChange={(v) => setProduto(idx, { nome_indefinido: !!v, nome_produto: v ? '' : p.nome_produto })}
                    />
                    Nome indefinido ainda
                  </label>
                </div>
                <div>
                  <Label className="text-xs">Segmento</Label>
                  <Select value={p.segmento} onValueChange={(v) => setProduto(idx, { segmento: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Orçamento de marca pensado em (rótulos comprados) *</Label>
                  <Input
                    type="number" min={0}
                    value={p.orcamento_qtd_rotulos || ''}
                    placeholder={`Mín. ${minimoRotulos(p.quantidade_potes)}`}
                    onChange={(e) => setProduto(idx, { orcamento_qtd_rotulos: Number(e.target.value) || 0 })}
                  />
                  {(() => {
                    const minimo = minimoRotulos(p.quantidade_potes);
                    const abaixo = !!p.orcamento_qtd_rotulos && p.orcamento_qtd_rotulos < minimo;
                    return (
                      <p className={`mt-1 text-[11px] ${abaixo ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {abaixo
                          ? `Abaixo do mínimo: precisa ser pelo menos ${minimo} rótulos (50% a mais que ${p.quantidade_potes} potes).`
                          : `Mínimo permitido: ${minimo} rótulos (50% a mais que ${p.quantidade_potes || 0} potes vendidos).`}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <Label className="text-xs">Orçamento de rótulo pensado na produção feita em *</Label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {LOCAIS_PRODUCAO.map((local) => {
                      const marcado = (p.locais_producao || []).includes(local);
                      return (
                        <label key={local} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={(v) =>
                              setProduto(idx, {
                                locais_producao: v
                                  ? [...(p.locais_producao || []), local]
                                  : (p.locais_producao || []).filter((x) => x !== local),
                              })
                            }
                          />
                          {local}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Arquivos de referência</Label>
          <label className="mt-1 flex items-center justify-center gap-2 border border-dashed rounded-lg py-3 text-xs cursor-pointer hover:bg-muted/40">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar arquivos
            <input type="file" multiple className="hidden" onChange={(e) => upload('referencia', e.target.files)} />
          </label>
          {renderArquivos('referencia')}
        </div>
        <div>
          <Label className="text-xs">Arquivo da marca / logo (preferência em vetor)</Label>
          <label className="mt-1 flex items-center justify-center gap-2 border border-dashed rounded-lg py-3 text-xs cursor-pointer hover:bg-muted/40">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar logo
            <input
              type="file" multiple className="hidden"
              accept=".ai,.eps,.svg,.pdf,.cdr,.png,.jpg,.jpeg"
              onChange={(e) => upload('logo', e.target.files)}
            />
          </label>
          {renderArquivos('logo')}
        </div>
      </div>

      <div>
        <Label className="text-xs">Observações para o designer</Label>
        <Textarea
          value={dados.observacoes || ''}
          onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
          placeholder="Detalhes adicionais..."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={submeter} disabled={salvando || enviando}>
          {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar demanda
        </Button>
      </div>
    </div>
  );
};

export default FormRotulo;
