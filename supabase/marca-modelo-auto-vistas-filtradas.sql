-- Ejecutar en el SQL Editor de Supabase, DESPUES de marca-modelo-auto.sql
-- y marca-modelo-auto-asociaciones.sql.
--
-- El filtro "Vehículo" del catálogo público no debe mostrar marcas sin
-- ningún artículo asociado (ej. Scania, Volvo, BMW hoy tienen 0). Se
-- resuelve con vistas en vez de hardcodear una lista: son vistas normales
-- (no materializadas), así que se recalculan solas en cada consulta — si
-- mañana se cargan artículos de una marca que hoy está vacía, aparece sola
-- en el filtro sin tocar nada más.

create or replace view public.marcas_auto_con_datos as
select ma.id, ma.descripcion
from public.marcas_auto ma
where exists (
  select 1
  from public.modelos_auto mo
  join public.articulos_modelos_auto amo on amo.id_modelo_auto = mo.id
  where mo.id_marca_auto = ma.id
);

create or replace view public.modelos_auto_con_datos as
select mo.id, mo.descripcion, mo.id_marca_auto
from public.modelos_auto mo
where exists (
  select 1 from public.articulos_modelos_auto amo where amo.id_modelo_auto = mo.id
);

grant select on public.marcas_auto_con_datos, public.modelos_auto_con_datos to anon, authenticated;
