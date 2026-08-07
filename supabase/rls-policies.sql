-- Ejecutar una sola vez en el SQL Editor del dashboard de Supabase.
-- Objetivo: lectura pública del catálogo, escritura solo para usuarios autenticados (el admin).
-- Idempotente: puede correrse más de una vez sin duplicar policies.

alter table articulos enable row level security;
alter table marcas enable row level security;
alter table rubros enable row level security;

drop policy if exists "Lectura publica" on articulos;
drop policy if exists "Lectura publica" on marcas;
drop policy if exists "Lectura publica" on rubros;
drop policy if exists "Escritura solo admin" on articulos;
drop policy if exists "Escritura solo admin" on marcas;
drop policy if exists "Escritura solo admin" on rubros;

create policy "Lectura publica" on articulos for select using (true);
create policy "Lectura publica" on marcas for select using (true);
create policy "Lectura publica" on rubros for select using (true);

create policy "Escritura solo admin" on articulos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Escritura solo admin" on marcas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Escritura solo admin" on rubros for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
