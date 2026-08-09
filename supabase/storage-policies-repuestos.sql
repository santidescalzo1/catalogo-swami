-- Ejecutar en el SQL Editor de Supabase.
-- El bucket "repuestos" ya es publico para lectura (por eso las fotos cargan
-- en el catalogo sin login), pero nunca tuvo policies de escritura via RLS
-- porque hasta ahora las fotos solo se subian con el script local
-- (subir_fotos.py), que usa la service_role key y evade RLS por completo.
-- Esto agrega permiso para que el panel /admin, con tu usuario logueado,
-- pueda subir y reemplazar fotos directamente desde la web.
--
-- Storage es un servicio aparte de PostgREST: no cambia el rol real de la
-- conexion a Postgres, asi que una policy con "to authenticated" nunca
-- matchea ahi (por eso seguia fallando con el GRANT y las policies ya
-- creadas). Hay que leer el usuario desde el JWT con auth.role() en vez de
-- restringir por rol de conexion.
grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "admin_sube_fotos_repuestos" on storage.objects;
create policy "admin_sube_fotos_repuestos" on storage.objects
  for insert
  with check (bucket_id = 'repuestos' and auth.role() = 'authenticated');

drop policy if exists "admin_reemplaza_fotos_repuestos" on storage.objects;
create policy "admin_reemplaza_fotos_repuestos" on storage.objects
  for update
  using (bucket_id = 'repuestos' and auth.role() = 'authenticated')
  with check (bucket_id = 'repuestos' and auth.role() = 'authenticated');

drop policy if exists "admin_borra_fotos_repuestos" on storage.objects;
create policy "admin_borra_fotos_repuestos" on storage.objects
  for delete
  using (bucket_id = 'repuestos' and auth.role() = 'authenticated');
