import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Notificação com a mesma voz do resto da interface: superfície de card,
 * sombra curta, raio contido e severidade no ícone — não no fundo inteiro.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      offset="24px"
      closeButton
      style={{ "--width": "380px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:items-start group-[.toaster]:gap-3 group-[.toaster]:rounded-[10px] group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:p-4 group-[.toaster]:text-foreground group-[.toaster]:shadow-strong",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold group-[.toast]:leading-snug",
          description:
            "group-[.toast]:mt-0.5 group-[.toast]:text-xs group-[.toast]:leading-[1.5] group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:mt-0.5 group-[.toast]:self-start",
          closeButton:
            "group-[.toast]:border-border group-[.toast]:bg-card group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:hover:bg-secondary",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Severidade mora no ícone, não numa faixa colorida atrás do texto.
          error: "group-[.toaster]:[&_[data-icon]]:text-destructive",
          success: "group-[.toaster]:[&_[data-icon]]:text-success",
          warning: "group-[.toaster]:[&_[data-icon]]:text-warning",
          info: "group-[.toaster]:[&_[data-icon]]:text-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
