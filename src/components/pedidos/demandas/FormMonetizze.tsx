import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { DadosMonetizze, EtapaMonetizze } from '@/types/demandaMarca';
import type { ProdutoPedido } from '@/types/demandaMarca';
import { resumoProdutoTexto } from './ProdutosPedidoResumo';

interface Props {
  produtosPedido: ProdutoPedido[];
  vendedorNome: string;
  valorInicial?: DadosMonetizze;
  salvando?: boolean;
  onCancelar: () => void;
  onSalvar: (dados: DadosMonetizze) => void;
}

export function etapasPadraoMonetizze(produtos: ProdutoPedido[], vendedorNome: string): EtapaMonetizze[] {
  const etapas: EtapaMonetizze[] = [{ descricao: 'Criar a conta na Monetizze', concluida: false }];
  const lista = produtos.length ? produtos : [{ nome_produto: 'Produto do pedido', tipo_produto: '', quantidade: 0 }];
  lista.forEach((p) => etapas.push({ descricao: `Criar produto: ${p.nome_produto}`, concluida: false }));
  lista.forEach((p) => etapas.push({ descricao: `Criar 1 plano para o produto: ${p.nome_produto}`, concluida: false }));
  lista.forEach((p) => etapas.push({ descricao: `Criar checkout do plano: ${p.nome_produto}`, concluida: false }));
  lista.forEach((p) => etapas.push({ descricao: `Colocar banner no checkout: ${p.nome_produto}`, concluida: false }));
  etapas.push({
    descricao: `Gerar link de divulgação do checkout e enviar para o vendedor responsável${vendedorNome ? ` (${vendedorNome})` : ''}`,
    concluida: false,
  });
  return etapas;
}

const FormMonetizze = ({ produtosPedido, vendedorNome, valorInicial, salvando, onCancelar, onSalvar }: Props) => {
  const [dados, setDados] = useState<DadosMonetizze>(
    valorInicial ?? {
      etapas: etapasPadraoMonetizze(produtosPedido, vendedorNome),
      link_divulgacao: '',
      observacoes: '',
    },
  );

  const toggle = (idx: number, v: boolean) =>
    setDados((d) => ({ ...d, etapas: d.etapas.map((e, i) => (i === idx ? { ...e, concluida: v } : e)) }));

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">Checklist da demanda de T.I para criação da conta e checkouts.</p>

      {produtosPedido.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold">Produtos do pedido</p>
          {produtosPedido.map((p, i) => (
            <div key={i}>
              <p className="text-sm">{p.nome_produto}</p>
              <p className="text-[11px] text-muted-foreground">{resumoProdutoTexto(p)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {dados.etapas.map((e, idx) => (
          <label key={idx} className="flex items-start gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40">
            <Checkbox checked={e.concluida} onCheckedChange={(v) => toggle(idx, !!v)} className="mt-0.5" />
            <span className={`text-sm ${e.concluida ? 'line-through text-muted-foreground' : ''}`}>{e.descricao}</span>
          </label>
        ))}
      </div>

      <div>
        <Label className="text-xs">Link de divulgação gerado</Label>
        <Input
          value={dados.link_divulgacao || ''}
          placeholder="https://..."
          onChange={(e) => setDados({ ...dados, link_divulgacao: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs">Observações para o T.I</Label>
        <Textarea value={dados.observacoes || ''} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button onClick={() => onSalvar(dados)} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar demanda
        </Button>
      </div>
    </div>
  );
};

export default FormMonetizze;
