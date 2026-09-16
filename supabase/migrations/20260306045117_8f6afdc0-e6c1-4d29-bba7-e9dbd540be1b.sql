
-- 1. Rename table insumos → materias_primas
ALTER TABLE public.insumos RENAME TO materias_primas;

-- 2. Rename function normalize_insumo_name → normalize_mp_name
CREATE OR REPLACE FUNCTION public.normalize_mp_name(input_name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result TEXT;
BEGIN
  result := lower(unaccent(trim(input_name)));
  result := regexp_replace(result, '[%/(),.]', ' ', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := regexp_replace(result, '\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*', ' ', 'g');
  result := regexp_replace(result, '\s+(ext|extrato|soluvel)\s*', ' ', 'g');
  result := regexp_replace(result, 'tipo\s*2', 'tipo ii', 'g');
  result := trim(regexp_replace(result, '\s+', ' ', 'g'));
  RETURN result;
END;
$function$;

-- Keep old function as alias for backward compatibility
CREATE OR REPLACE FUNCTION public.normalize_insumo_name(input_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT normalize_mp_name(input_name);
$$;

-- 3. Update trigger function to use new function name
CREATE OR REPLACE FUNCTION public.set_normalized_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.normalized_name := normalize_mp_name(NEW.nome);
  RETURN NEW;
END;
$function$;

-- 4. Create trigger on materias_primas (if not exists)
DROP TRIGGER IF EXISTS set_normalized_name_trigger ON public.materias_primas;
CREATE TRIGGER set_normalized_name_trigger
  BEFORE INSERT OR UPDATE ON public.materias_primas
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_name();

-- 5. Create trigger for updated_at on materias_primas
DROP TRIGGER IF EXISTS update_materias_primas_updated_at ON public.materias_primas;
CREATE TRIGGER update_materias_primas_updated_at
  BEFORE UPDATE ON public.materias_primas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Create lotes table
CREATE TABLE public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  item_tipo text NOT NULL CHECK (item_tipo IN ('materia_prima', 'embalagem')),
  quantidade numeric NOT NULL DEFAULT 0,
  validade date,
  custo_unitario numeric NOT NULL,
  fornecedor text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Enable RLS on lotes
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for lotes (public access like other tables)
CREATE POLICY "Permitir leitura publica de lotes" ON public.lotes FOR SELECT USING (true);
CREATE POLICY "Permitir insercao publica de lotes" ON public.lotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao publica de lotes" ON public.lotes FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusao publica de lotes" ON public.lotes FOR DELETE USING (true);

-- 9. Trigger for updated_at on lotes
CREATE TRIGGER update_lotes_updated_at
  BEFORE UPDATE ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Enable realtime for lotes
ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes;
