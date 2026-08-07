-- Ejecutar en el SQL Editor del dashboard de Supabase.
-- Agrega una columna generada con la descripcion sin espacios ni signos,
-- para que el buscador encuentre "cubrevolantes" (pegado) aunque el articulo
-- este cargado como "CUBRE VOLANTE" (separado), y viceversa.
--
-- Es una columna GENERATED: Postgres la recalcula solo cada vez que se
-- inserta o actualiza un articulo (incluida la carga semanal del Excel via
-- upsert), no requiere mantenimiento manual.

alter table public.articulos
  add column if not exists descripcion_normalizada text
  generated always as (
    lower(regexp_replace(descripcion, '[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]', '', 'g'))
  ) stored;
