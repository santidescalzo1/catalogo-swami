-- Ejecutar en el SQL Editor de Supabase.
-- El bucket "repuestos" ya es publico para lectura (por eso las fotos cargan
-- en el catalogo sin login), pero nunca tuvo policies de escritura via RLS
-- porque hasta ahora las fotos solo se subian con el script local
-- (subir_fotos.py), que usa la service_role key y evade RLS por completo.
-- Esto agrega permiso para que el panel /admin, con tu usuario logueado,
-- pueda subir y reemplazar fotos directamente desde la web.

create policy "admin_sube_fotos_repuestos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'repuestos');

create policy "admin_reemplaza_fotos_repuestos" on storage.objects
  for update to authenticated
  using (bucket_id = 'repuestos')
  with check (bucket_id = 'repuestos');

create policy "admin_borra_fotos_repuestos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'repuestos');
