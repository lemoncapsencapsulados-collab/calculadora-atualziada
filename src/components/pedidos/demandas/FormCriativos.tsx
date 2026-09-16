import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CriativoProduto, DadosCriativos, OBJETIVOS_CRIATIVO } from '@/types/demandaMarca';
import type { ProdutoPedido } from '@/types/demandaMarca';
import { ResumoProdutoLinha } from './ProdutosPedidoResumo';

interface Props {
  produtosPedido: ProdutoPedido[];
  valorInicial?: DadosCriativos;
  salvando?: boolean;
  onCancelar: () => void;
  onSalvar: (dados: DadosCriativos) => void;
}

const MAX = 3;

const FormCriativos = ({ produtosPedido, valorInicial, salvando, onCancelar, onSalvar }: Props) => {
  const [dados, setDados] = useState<DadosCriativos>(
    valorInicial ?? {
      produtos: (produtosPedido.length ? produtosPedido : [{ nome_produto: 'Produto', tipo_produto: '', quantidade: 0 }]).map((p) => ({
        nome_produto: p.nome_produto,
        quantidade: 1,
        objetivos: [''],
      })),
      observacoes: '',
    },
  );

  const setProduto = (idx: number, patch: Partial<CriativoProduto>) =>
    setDados((d) => ({ ...d, produtos: d.produtos.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));

  const infoProduto = (nome: string) => produtosPedido.find((x) => x.nome_produto === nome);

  const setQuantidade = (idx: number, qtd: number) => {
    const q = Math.max(0, Math.min(MAX, qtd));
    const atual = dados.produtos[idx];
    const objetivos = Array.from({ length: q }, (_, i) => atual.objetivos[i] || '');
    setProduto(idx, { quantidade: q, objetivos });
  };

  const submeter = () => {
    const ativos = dados.produtos.filter((p) => p.quantidade > 0);
    if (!ativos.length) return toast.error('Defina a quantidade de criativos de ao menos um produto.');
    for (const p of ativos) {
      if (p.quantidade > MAX) return toast.error('Máximo de 3 criativos por produto.');
      if (p.objetivos.some((o) => !o)) return toast.error(`Selecione o objetivo de cada criativo de "${p.nome_produto}".`);
    }
    onSalvar({ ...dados, produtos: ativos });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Cada produto pode ter no máximo 3 criativos, e cada criativo tem 1 objetivo.
      </p>

      <div className="space-y-3">
        {dados.produtos.map((p, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-medium truncate">{p.nome_produto}</span>
                <ResumoProdutoLinha produto={infoProduto(p.nome_produto)} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Quantidade</Label>
                <Select value={String(p.quantidade)} onValueChange={(v) => setQuantidade(idx, Number(v))}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {p.objetivos.map((obj, oi) => (
              <div key={oi}>
                <Label className="text-xs">Objetivo do criativo {oi + 1}</Label>
                <Select
                  value={obj}
                  onValueChange={(v) => setProduto(idx, { objetivos: p.objetivos.map((o, i) => (i === oi ? v : o)) })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o objetivo" /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVOS_CRIATIVO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">Observações para o designer</Label>
        <Textarea
          value={dados.observacoes || ''}
          onChange={(e) => setDados({ ...dados, observacoes: e.target.value })}
        />
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

export default FormCriativos;
