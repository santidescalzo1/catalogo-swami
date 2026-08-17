-- Correccion sobre proveedores-y-backfill.sql: la columna "oculto" se penso
-- para ocultar el articulo entero del catalogo publico, pero el pedido real
-- era mas acotado (ocultar solo el codigo REF del proveedor en el detalle,
-- el articulo se sigue mostrando). Se renombra para reflejar el alcance real.
-- Ya aplicado directo via el conector MCP de Supabase el 2026-08-17.

alter table public.proveedores rename column oculto to ocultar_codigo_proveedor;
