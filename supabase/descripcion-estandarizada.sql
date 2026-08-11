-- Ejecutar en el SQL Editor de Supabase.
-- Objetivo: permitir estandarizar el formato de las descripciones desde
-- /admin/articulos sin que se pierda al re-importar el Excel del sistema de
-- facturacion del cliente. Tanto actualizar_precios.py como el botón
-- "Sincronizar Catálogo" del panel pisan la fila completa (incluida
-- "descripcion") con lo que traiga el Excel en cada corrida, así que
-- cualquier edición manual sobre "descripcion" se perdería en el próximo
-- import.
--
-- Se agrega una columna separada que ningún import toca. El catálogo
-- público y el buscador la usan si está cargada, y si no caen a la
-- "descripcion" cruda de siempre (COALESCE). Así lo estandarizado queda
-- protegido de los próximos imports.
--
-- Idempotente: puede correrse de nuevo sin romper nada.

alter table public.articulos
  add column if not exists descripcion_estandarizada text;

-- La columna generada "descripcion_normalizada" (ver busqueda-normalizada.sql)
-- hoy se calcula solo a partir de "descripcion". Postgres no permite alterar
-- la expresión de una columna generada in-place, así que hay que recrearla
-- para que también priorice la versión estandarizada cuando exista. Al ser
-- GENERATED ... STORED, Postgres recalcula el valor de las ~4000 filas
-- existentes al recrearla; es una operación barata a este volumen.
alter table public.articulos drop column if exists descripcion_normalizada;

alter table public.articulos
  add column descripcion_normalizada text
  generated always as (
    lower(regexp_replace(coalesce(descripcion_estandarizada, descripcion), '[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]', '', 'g'))
  ) stored;
