import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BannerProduto, DadosBanner } from '@/types/demandaMarca';
import type { ProdutoPedido } from '@/types/demandaMarca';
import { ResumoProdutoLinha } from './ProdutosPedidoResumo';

interface Props {
  produtosPedido: ProdutoPedido[];
  valorInicial?: DadosBanner;
  salvando?: boolean;
  onCancelar: () => void;
  onSalvar: (dados: DadosBanner) => void;
}

const FormBanner = ({ produtosPedido, valorInicial, salvando, onCancelar, onSalvar }: Props) => {
  const [dados, setDados] = useState<DadosBanner>(
    valorInicial ?? {
      produtos: (produtosPedido.length ? produtosPedido : [{ nome_produto: 'Produto', tipo_produto: '', quantidade: 0 }]).map((p) => ({
        nome_produto: p.nome_produto,
        selecionado: true,
        vertical: true,
        horizontal: true,
      })),
      observacoes: '',
    },
  );

  const setProduto = (idx: number, patch: Partial<BannerProduto>) =>
    setDados((d) => ({ ...d, produtos: d.produtos.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));

  const infoProduto = (nome: string) => produtosPedido.find((x) => x.nome_produto === nome);

  const submeter = () => {
    const ativos = dados.produtos.filter((p) => p.selecionado && (p.vertical || p.horizontal));
    if (!ativos.length) return toast.error('Selecione ao menos um produto com um formato de banner.');
    onSalvar({ ...dados, produtos: dados.produtos.map((p) => ({ ...p, selecionado: p.selecionado && (p.vertical || p.horizontal) })) });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Cada produto selecionado gera a demanda de 1 banner vertical e 1 banner horizontal.
      </p>

      <div className="space-y-2">
        {dados.produtos.map((p, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={p.selecionado} onCheckedChange={(v) => setProduto(idx, { selecionado: !!v })} />
              <span className="text-sm font-medium">{p.nome_produto}</span>
            </label>
            <div className="pl-6 -mt-1">
              <ResumoProdutoLinha produto={infoProduto(p.nome_produto)} />
            </div>
            {p.selecionado && (
              <div className="flex flex-wrap gap-4 pl-6">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={p.vertical} onCheckedChange={(v) => setProduto(idx, { vertical: !!v })} />
                  1 banner vertical
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={p.horizontal} onCheckedChange={(v) => setProduto(idx, { horizontal: !!v })} />
                  1 banner horizontal
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">Observações para o designer</Label>
        <Textarea value={dados.observacoes || ''} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={submeter} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar demanda
        </Button>
      </div>
    </div>
  );
};

export default FormBanner;
