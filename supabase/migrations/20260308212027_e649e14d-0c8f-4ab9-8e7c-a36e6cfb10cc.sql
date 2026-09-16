CREATE OR REPLACE FUNCTION public.unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public, extensions
AS $$
  SELECT extensions.unaccent($1);
$$;
