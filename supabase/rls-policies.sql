-- Ejecutar en el SQL Editor del dashboard de Supabase.
-- Objetivo: lectura publica del catalogo (sin excepciones), escritura solo para usuarios
-- logueados (el panel /admin). SELECT tiene una unica policy que la gobierna, sin
-- ambiguedad con las policies de escritura (evita el 403 que ve un usuario autenticado
-- cuando una policy "for all" tambien pisa el SELECT).
--
-- Las policies de RLS solo restringen FILAS; antes de eso Postgres exige un GRANT de
-- tabla para el rol. Si estas tablas se crearon pensando solo en el catalogo publico,
-- es probable que el rol "authenticated" nunca haya tenido GRANT SELECT (solo "anon"),
-- lo que produce un 403 para cualquier usuario logueado sin importar las policies.
-- Por eso el script otorga los GRANTs explicitamente antes de tocar RLS.
--
-- Idempotente: borra cualquier policy existente en estas tablas antes de recrear,
-- incluyendo las que se hayan creado a mano desde el dashboard.

grant usage on schema public to anon, authenticated;

grant select on public.articulos, public.marcas, public.rubros to anon, authenticated;
grant insert, update, delete on public.articulos, public.marcas, public.rubros to authenticated;

do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('articulos', 'marcas', 'rubros')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.articulos enable row level security;
alter table public.marcas    enable row level security;
alter table public.rubros    enable row level security;

-- Lectura: publica, una sola policy por tabla, sin condiciones.
create policy "lectura_publica" on public.articulos for select to public using (true);
create policy "lectura_publica" on public.marcas    for select to public using (true);
create policy "lectura_publica" on public.rubros    for select to public using (true);

-- Escritura: solo usuarios logueados (auth.uid() existe), una policy por operacion.
create policy "escritura_admin_insert" on public.articulos for insert to authenticated with check (true);
create policy "escritura_admin_update" on public.articulos for update to authenticated using (true) with check (true);
create policy "escritura_admin_delete" on public.articulos for delete to authenticated using (true);

create policy "escritura_admin_insert" on public.marcas for insert to authenticated with check (true);
create policy "escritura_admin_update" on public.marcas for update to authenticated using (true) with check (true);
create policy "escritura_admin_delete" on public.marcas for delete to authenticated using (true);

create policy "escritura_admin_insert" on public.rubros for insert to authenticated with check (true);
create policy "escritura_admin_update" on public.rubros for update to authenticated using (true) with check (true);
create policy "escritura_admin_delete" on public.rubros for delete to authenticated using (true);
