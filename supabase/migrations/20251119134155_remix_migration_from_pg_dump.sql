--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: normalize_insumo_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_insumo_name(input_name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  result TEXT;
BEGIN
  -- Converter para minúsculas e remover acentos
  result := lower(unaccent(trim(input_name)));
  
  -- Substituir caracteres especiais por espaço
  result := regexp_replace(result, '[%/(),.]', ' ', 'g');
  
  -- Remover múltiplos espaços
  result := regexp_replace(result, '\s+', ' ', 'g');
  
  -- Remover termos cosméticos comuns
  result := regexp_replace(result, '\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*', ' ', 'g');
  result := regexp_replace(result, '\s+(ext|extrato|soluvel)\s*', ' ', 'g');
  
  -- Padronizar "tipo 2" para "tipo ii"
  result := regexp_replace(result, 'tipo\s*2', 'tipo ii', 'g');
  
  -- Remover espaços extras novamente
  result := trim(regexp_replace(result, '\s+', ' ', 'g'));
  
  RETURN result;
END;
$$;


--
-- Name: set_normalized_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_normalized_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.normalized_name := normalize_insumo_name(NEW.nome);
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: embalagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embalagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text NOT NULL,
    preco_unitario numeric(15,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    categoria text,
    subcategoria text
);

ALTER TABLE ONLY public.embalagens REPLICA IDENTITY FULL;


--
-- Name: formulas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formulas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente text NOT NULL,
    nome_formula text NOT NULL,
    tipo_produto text NOT NULL,
    qtd_capsulas numeric NOT NULL,
    itens jsonb NOT NULL,
    embalagens jsonb NOT NULL,
    total_mp numeric NOT NULL,
    total_embalagem numeric NOT NULL,
    custo_total numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insumos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    unidade_compra text NOT NULL,
    preco_compra numeric(15,6) NOT NULL,
    densidade numeric(10,4),
    fornecedor text,
    categoria text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    normalized_name text
);

ALTER TABLE ONLY public.insumos REPLICA IDENTITY FULL;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formula_id uuid NOT NULL,
    numero_pedido text NOT NULL,
    data_pedido timestamp with time zone NOT NULL,
    data_entrega timestamp with time zone NOT NULL,
    quantidade_produto numeric NOT NULL,
    unidade_produto text NOT NULL,
    observacoes text,
    status text DEFAULT 'aguardando_producao'::text NOT NULL,
    formula_snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pedidos_status_check CHECK ((status = ANY (ARRAY['aguardando_producao'::text, 'no_estoque'::text, 'enviado'::text, 'concluido'::text])))
);


--
-- Name: embalagens embalagens_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embalagens
    ADD CONSTRAINT embalagens_nome_key UNIQUE (nome);


--
-- Name: embalagens embalagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embalagens
    ADD CONSTRAINT embalagens_pkey PRIMARY KEY (id);


--
-- Name: formulas formulas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formulas
    ADD CONSTRAINT formulas_pkey PRIMARY KEY (id);


--
-- Name: insumos insumos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumos
    ADD CONSTRAINT insumos_nome_key UNIQUE (nome);


--
-- Name: insumos insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumos
    ADD CONSTRAINT insumos_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_numero_pedido_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_numero_pedido_key UNIQUE (numero_pedido);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: idx_embalagens_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embalagens_nome ON public.embalagens USING btree (nome);


--
-- Name: idx_formulas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formulas_cliente ON public.formulas USING btree (cliente);


--
-- Name: idx_formulas_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formulas_created_at ON public.formulas USING btree (created_at DESC);


--
-- Name: idx_formulas_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_formulas_nome ON public.formulas USING btree (nome_formula);


--
-- Name: idx_insumos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insumos_categoria ON public.insumos USING btree (categoria);


--
-- Name: idx_insumos_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insumos_nome ON public.insumos USING btree (nome);


--
-- Name: idx_insumos_normalized_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insumos_normalized_name ON public.insumos USING btree (normalized_name);


--
-- Name: idx_pedidos_data_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_data_pedido ON public.pedidos USING btree (data_pedido DESC);


--
-- Name: idx_pedidos_formula_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_formula_id ON public.pedidos USING btree (formula_id);


--
-- Name: idx_pedidos_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_numero ON public.pedidos USING btree (numero_pedido);


--
-- Name: idx_pedidos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_status ON public.pedidos USING btree (status);


--
-- Name: insumos trigger_set_normalized_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_normalized_name BEFORE INSERT OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.set_normalized_name();


--
-- Name: embalagens update_embalagens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_embalagens_updated_at BEFORE UPDATE ON public.embalagens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: formulas update_formulas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_formulas_updated_at BEFORE UPDATE ON public.formulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: insumos update_insumos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pedidos update_pedidos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pedidos pedidos_formula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_formula_id_fkey FOREIGN KEY (formula_id) REFERENCES public.formulas(id) ON DELETE CASCADE;


--
-- Name: embalagens Permitir atualização pública de embalagens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir atualização pública de embalagens" ON public.embalagens FOR UPDATE USING (true);


--
-- Name: formulas Permitir atualização pública de fórmulas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir atualização pública de fórmulas" ON public.formulas FOR UPDATE USING (true);


--
-- Name: insumos Permitir atualização pública de insumos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir atualização pública de insumos" ON public.insumos FOR UPDATE USING (true);


--
-- Name: pedidos Permitir atualização pública de pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir atualização pública de pedidos" ON public.pedidos FOR UPDATE USING (true);


--
-- Name: embalagens Permitir exclusão pública de embalagens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir exclusão pública de embalagens" ON public.embalagens FOR DELETE USING (true);


--
-- Name: formulas Permitir exclusão pública de fórmulas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir exclusão pública de fórmulas" ON public.formulas FOR DELETE USING (true);


--
-- Name: insumos Permitir exclusão pública de insumos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir exclusão pública de insumos" ON public.insumos FOR DELETE USING (true);


--
-- Name: pedidos Permitir exclusão pública de pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir exclusão pública de pedidos" ON public.pedidos FOR DELETE USING (true);


--
-- Name: embalagens Permitir inserção pública de embalagens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserção pública de embalagens" ON public.embalagens FOR INSERT WITH CHECK (true);


--
-- Name: formulas Permitir inserção pública de fórmulas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserção pública de fórmulas" ON public.formulas FOR INSERT WITH CHECK (true);


--
-- Name: insumos Permitir inserção pública de insumos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserção pública de insumos" ON public.insumos FOR INSERT WITH CHECK (true);


--
-- Name: pedidos Permitir inserção pública de pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserção pública de pedidos" ON public.pedidos FOR INSERT WITH CHECK (true);


--
-- Name: embalagens Permitir leitura pública de embalagens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura pública de embalagens" ON public.embalagens FOR SELECT USING (true);


--
-- Name: formulas Permitir leitura pública de fórmulas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura pública de fórmulas" ON public.formulas FOR SELECT USING (true);


--
-- Name: insumos Permitir leitura pública de insumos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura pública de insumos" ON public.insumos FOR SELECT USING (true);


--
-- Name: pedidos Permitir leitura pública de pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura pública de pedidos" ON public.pedidos FOR SELECT USING (true);


--
-- Name: embalagens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.embalagens ENABLE ROW LEVEL SECURITY;

--
-- Name: formulas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

--
-- Name: insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


