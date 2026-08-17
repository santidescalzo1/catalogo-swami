-- Ejecutar en el SQL Editor de Supabase.
--
-- Motivo: se agrega login de clientes al catalogo publico (Supabase Auth,
-- el mismo mecanismo que ya usa /admin/login). Hasta ahora TODAS las
-- policies de escritura del catalogo usaban "to authenticated" a secas,
-- lo cual era seguro porque la UNICA cuenta autenticada que existia era
-- la del admin. En cuanto exista la primera cuenta de cliente, ese "to
-- authenticated" dejaria de significar "el admin" y pasaria a significar
-- "cualquier usuario logueado, incluidos los clientes" - un cliente
-- logueado podria editar articulos/precios/marcas directamente, y hasta
-- entrar a /admin tipeando la URL (proxy.ts solo chequea "hay sesion",
-- no quien es). Este archivo cierra esa brecha ANTES de que exista el
-- primer cliente, no despues.
--
-- Se agrega una tabla "admins" (lista explicita de quien es admin) y se
-- la usa en vez de "to authenticated" en cada policy de escritura ya
-- existente, mas en proxy.ts y en la ruta de subir fotos (codigo aparte,
-- no en este archivo). El default ahora es seguro: un usuario autenticado
-- que no esta en admins no puede escribir nada ni entrar a /admin.

-- ============================================================
-- 1. Tabla admins (allowlist explicita, no hay auto-alta)
-- ============================================================
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade
);

grant select on public.admins to authenticated;
alter table public.admins enable row level security;

-- Cada admin solo ve su propia fila. Alcanza: las policies de otras
-- tablas hacen "auth.uid() in (select id from public.admins)", y esa
-- subconsulta ya pasa por esta misma RLS - a un no-admin le devuelve
-- vacio (osea "false"), a un admin le devuelve su propia fila (osea
-- "true"). No hace falta que un admin vea la lista completa de admins.
drop policy if exists "leer_propia_fila" on public.admins;
create policy "leer_propia_fila" on public.admins for select to authenticated using (auth.uid() = id);

-- Correr una sola vez, reemplazando el mail por el que usan para entrar
-- a /admin/login. Si ya corriste esto antes, no hace falta repetirlo.
-- insert into public.admins (id)
--   select id from auth.users where email = 'TU-EMAIL-DE-ADMIN-ACA'
--   on conflict do nothing;

-- ============================================================
-- 2. Tabla clientes (perfil de cliente logueado en el catalogo)
-- ============================================================
-- Hoy no se usa para nada mas que identificar "este usuario es un
-- cliente, no un admin". El campo descuento_pct queda listo para cuando
-- se arme el precio personalizado por cliente.
create table if not exists public.clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  descuento_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clientes to authenticated;
alter table public.clientes enable row level security;

drop policy if exists "cliente_lee_lo_suyo_admin_lee_todo" on public.clientes;
create policy "cliente_lee_lo_suyo_admin_lee_todo" on public.clientes
  for select to authenticated
  using (auth.uid() = id or auth.uid() in (select id from public.admins));

-- Solo el admin da de alta/edita/borra clientes (un cliente no puede
-- auto-asignarse un descuento editando su propia fila).
drop policy if exists "solo_admin_administra_clientes" on public.clientes;
create policy "solo_admin_administra_clientes" on public.clientes
  for insert to authenticated
  with check (auth.uid() in (select id from public.admins));

drop policy if exists "solo_admin_edita_clientes" on public.clientes;
create policy "solo_admin_edita_clientes" on public.clientes
  for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));

drop policy if exists "solo_admin_borra_clientes" on public.clientes;
create policy "solo_admin_borra_clientes" on public.clientes
  for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- ============================================================
-- 3. Reemplaza "to authenticated" por "es admin" en escritura
-- ============================================================

-- articulos
drop policy if exists "escritura_admin_insert" on public.articulos;
create policy "escritura_admin_insert" on public.articulos for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_update" on public.articulos;
create policy "escritura_admin_update" on public.articulos for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.articulos;
create policy "escritura_admin_delete" on public.articulos for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- marcas
drop policy if exists "escritura_admin_insert" on public.marcas;
create policy "escritura_admin_insert" on public.marcas for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_update" on public.marcas;
create policy "escritura_admin_update" on public.marcas for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.marcas;
create policy "escritura_admin_delete" on public.marcas for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- rubros
drop policy if exists "escritura_admin_insert" on public.rubros;
create policy "escritura_admin_insert" on public.rubros for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_update" on public.rubros;
create policy "escritura_admin_update" on public.rubros for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.rubros;
create policy "escritura_admin_delete" on public.rubros for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- marcas_auto
drop policy if exists "escritura_admin_insert" on public.marcas_auto;
create policy "escritura_admin_insert" on public.marcas_auto for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_update" on public.marcas_auto;
create policy "escritura_admin_update" on public.marcas_auto for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.marcas_auto;
create policy "escritura_admin_delete" on public.marcas_auto for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- modelos_auto
drop policy if exists "escritura_admin_insert" on public.modelos_auto;
create policy "escritura_admin_insert" on public.modelos_auto for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_update" on public.modelos_auto;
create policy "escritura_admin_update" on public.modelos_auto for update to authenticated
  using (auth.uid() in (select id from public.admins))
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.modelos_auto;
create policy "escritura_admin_delete" on public.modelos_auto for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- articulos_modelos_auto (solo insert/delete, nunca tuvo update)
drop policy if exists "escritura_admin_insert" on public.articulos_modelos_auto;
create policy "escritura_admin_insert" on public.articulos_modelos_auto for insert to authenticated
  with check (auth.uid() in (select id from public.admins));
drop policy if exists "escritura_admin_delete" on public.articulos_modelos_auto;
create policy "escritura_admin_delete" on public.articulos_modelos_auto for delete to authenticated
  using (auth.uid() in (select id from public.admins));

-- storage.objects (bucket "repuestos") - usa auth.role() en vez de "to
-- authenticated" por la razon ya documentada en storage-policies-repuestos.sql
-- (Storage no hace SET ROLE por request), asi que el chequeo de admin se
-- agrega como condicion extra en el mismo using/with check.
drop policy if exists "admin_sube_fotos_repuestos" on storage.objects;
create policy "admin_sube_fotos_repuestos" on storage.objects
  for insert
  with check (bucket_id = 'repuestos' and auth.role() = 'authenticated' and auth.uid() in (select id from public.admins));

drop policy if exists "admin_reemplaza_fotos_repuestos" on storage.objects;
create policy "admin_reemplaza_fotos_repuestos" on storage.objects
  for update
  using (bucket_id = 'repuestos' and auth.role() = 'authenticated' and auth.uid() in (select id from public.admins))
  with check (bucket_id = 'repuestos' and auth.role() = 'authenticated' and auth.uid() in (select id from public.admins));

drop policy if exists "admin_borra_fotos_repuestos" on storage.objects;
create policy "admin_borra_fotos_repuestos" on storage.objects
  for delete
  using (bucket_id = 'repuestos' and auth.role() = 'authenticated' and auth.uid() in (select id from public.admins));
