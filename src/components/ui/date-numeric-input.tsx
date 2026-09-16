import { useRef } from 'react';
import { Input } from '@/components/ui/input';

export function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function buildDate(d: string, m: string, a: string): Date | null {
  if (d.length === 0 || m.length === 0 || a.length < 4) return null;
  const dia = parseInt(d, 10);
  const mes = parseInt(m, 10);
  const ano = parseInt(a, 10);
  if (!dia || !mes || !ano) return null;
  if (mes < 1 || mes > 12) return null;
  const last = lastDayOfMonth(ano, mes);
  const diaFinal = Math.min(Math.max(dia, 1), last);
  return new Date(ano, mes - 1, diaFinal);
}

interface DateNumericInputProps {
  dia: string;
  mes: string;
  ano: string;
  onChange: (dia: string, mes: string, ano: string, date: Date | null) => void;
}

export function DateNumericInput({ dia, mes, ano, onChange }: DateNumericInputProps) {
  const mesRef = useRef<HTMLInputElement>(null);
  const anoRef = useRef<HTMLInputElement>(null);

  const update = (d: string, m: string, a: string) => {
    onChange(d, m, a, buildDate(d, m, a));
  };

  const handleDia = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    update(v, mes, ano);
  };

  const handleMes = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    update(dia, v, ano);
  };

  const handleAno = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 4);
    update(dia, mes, v);
  };

  const blurDia = () => {
    if (!dia) return;
    let n = parseInt(dia, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 31) n = 31;
    const padded = String(n).padStart(2, '0');
    update(padded, mes, ano);
  };

  const blurMes = () => {
    if (!mes) return;
    let n = parseInt(mes, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 12) n = 12;
    const padded = String(n).padStart(2, '0');
    update(dia, padded, ano);
  };

  const blurAno = () => {
    if (!ano) return;
    if (ano.length < 4) return;
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="text"
        inputMode="numeric"
        value={dia}
        onChange={(e) => handleDia(e.target.value)}
        onBlur={blurDia}
        placeholder="DD"
        maxLength={2}
        className="w-14 text-center px-1"
      />
      <span className="text-muted-foreground">/</span>
      <Input
        ref={mesRef}
        type="text"
        inputMode="numeric"
        value={mes}
        onChange={(e) => handleMes(e.target.value)}
        onBlur={blurMes}
        placeholder="MM"
        maxLength={2}
        className="w-14 text-center px-1"
      />
      <span className="text-muted-foreground">/</span>
      <Input
        ref={anoRef}
        type="text"
        inputMode="numeric"
        value={ano}
        onChange={(e) => handleAno(e.target.value)}
        onBlur={blurAno}
        placeholder="AAAA"
        maxLength={4}
        className="w-20 text-center px-1"
      />
    </div>
  );
}