import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Campos numéricos herdam a voz dos números do sistema: mono tabular.
    // Vale para quantidade de cápsulas, doses, preços — em todas as telas.
    const isNumeric = type === "number";

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "placeholder:text-muted-foreground",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "hover:border-border-strong",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "md:text-sm",
          isNumeric && "num tracking-normal",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
