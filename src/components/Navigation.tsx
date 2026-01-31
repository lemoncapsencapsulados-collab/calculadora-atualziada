import { Link, useLocation } from 'react-router-dom';
import { Package, Calculator, FlaskConical, FileText, ClipboardList, DollarSign, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navigation() {
  const location = useLocation();
  
  const links = [
    { to: '/', label: 'Calcular Fórmula', icon: Calculator },
    { to: '/cotacoes', label: 'Cotações Salvas', icon: FileText },
    { to: '/precificacao', label: 'Precificação Final', icon: DollarSign },
    { to: '/orcamentos', label: 'Orçamentos', icon: Receipt },
    { to: '/pedidos', label: 'Pedidos Gerados', icon: ClipboardList },
    { to: '/inventario', label: 'Inventário', icon: Package },
  ];

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <FlaskConical className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Calculadora de Fórmulas</h1>
              <p className="text-xs text-muted-foreground">Sistema de Cotação</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                    'hover:bg-secondary/80',
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
