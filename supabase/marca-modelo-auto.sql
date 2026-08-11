-- Ejecutar en el SQL Editor de Supabase.
-- Punto 6 del roadmap: filtro de compatibilidad por marca/modelo de auto.
--
-- El Excel del proveedor no trae esta info en columnas separadas: viene
-- como texto libre dentro de articulos.descripcion (ej. "FILTRO NAFTA FIAT
-- PALIO"). Este archivo solo crea el esquema y carga el diccionario de
-- marcas/modelos que pasó el cliente (fijo, sin ambigüedad). Las
-- asociaciones articulo <-> modelo (la parte con ambigüedad real, ej. "GOL"
-- modelo vs. palabra suelta) se generan aparte con un script de matching
-- sobre los datos reales, y se entregan en un SQL separado después de
-- revisar una muestra con el cliente.
--
-- Decisiones de diseño tomadas acá (avisar si alguna no es la esperada):
-- * Se fusionaron los grupos que el cliente separó por versión pesada/liviana
--   de una misma marca real (ej. "Mercedes Benz (Vans)" + "Mercedes Benz
--   (Pesados)" -> una sola marca "Mercedes Benz" con todos los modelos
--   juntos). Mismo criterio para Ford, VW e Iveco.
-- * Cada marca tiene un modelo "Genérico" además de sus modelos puntuales,
--   para los artículos donde la descripción menciona la marca pero no un
--   modelo específico (ej. "BOMBA DE AGUA CHEVROLET" a secas). Sin esto,
--   esos artículos no tendrían dónde engancharse aunque sí sepamos la marca.
-- * "Universal" (el fallback pedido por el cliente para artículos sin
--   ningún match) también es una marca con un único modelo "Genérico", para
--   que el esquore Artículo<->Modelo sea consistente en todos los casos.
--
-- Idempotente: puede correrse de nuevo sin duplicar filas.

create table if not exists public.marcas_auto (
  id serial primary key,
  descripcion text not null unique
);

create table if not exists public.modelos_auto (
  id serial primary key,
  id_marca_auto integer not null references public.marcas_auto(id) on delete cascade,
  descripcion text not null,
  unique (id_marca_auto, descripcion)
);

create table if not exists public.articulos_modelos_auto (
  id_articulo integer not null references public.articulos(id) on delete cascade,
  id_modelo_auto integer not null references public.modelos_auto(id) on delete cascade,
  primary key (id_articulo, id_modelo_auto)
);

grant usage on schema public to anon, authenticated;
grant select on public.marcas_auto, public.modelos_auto, public.articulos_modelos_auto to anon, authenticated;
grant insert, update, delete on public.marcas_auto, public.modelos_auto, public.articulos_modelos_auto to authenticated;

alter table public.marcas_auto enable row level security;
alter table public.modelos_auto enable row level security;
alter table public.articulos_modelos_auto enable row level security;

drop policy if exists "lectura_publica" on public.marcas_auto;
create policy "lectura_publica" on public.marcas_auto for select to public using (true);
drop policy if exists "escritura_admin_insert" on public.marcas_auto;
create policy "escritura_admin_insert" on public.marcas_auto for insert to authenticated with check (true);
drop policy if exists "escritura_admin_update" on public.marcas_auto;
create policy "escritura_admin_update" on public.marcas_auto for update to authenticated using (true) with check (true);
drop policy if exists "escritura_admin_delete" on public.marcas_auto;
create policy "escritura_admin_delete" on public.marcas_auto for delete to authenticated using (true);

drop policy if exists "lectura_publica" on public.modelos_auto;
create policy "lectura_publica" on public.modelos_auto for select to public using (true);
drop policy if exists "escritura_admin_insert" on public.modelos_auto;
create policy "escritura_admin_insert" on public.modelos_auto for insert to authenticated with check (true);
drop policy if exists "escritura_admin_update" on public.modelos_auto;
create policy "escritura_admin_update" on public.modelos_auto for update to authenticated using (true) with check (true);
drop policy if exists "escritura_admin_delete" on public.modelos_auto;
create policy "escritura_admin_delete" on public.modelos_auto for delete to authenticated using (true);

drop policy if exists "lectura_publica" on public.articulos_modelos_auto;
create policy "lectura_publica" on public.articulos_modelos_auto for select to public using (true);
drop policy if exists "escritura_admin_insert" on public.articulos_modelos_auto;
create policy "escritura_admin_insert" on public.articulos_modelos_auto for insert to authenticated with check (true);
drop policy if exists "escritura_admin_delete" on public.articulos_modelos_auto;
create policy "escritura_admin_delete" on public.articulos_modelos_auto for delete to authenticated using (true);

-- Marcas de auto (35 + Universal)
insert into public.marcas_auto (descripcion) values
  ('VW'), ('Chevrolet'), ('Fiat'), ('Ford'), ('Renault'), ('Peugeot'), ('Citroen'),
  ('Toyota'), ('Honda'), ('Nissan'), ('Jeep'), ('Mercedes Benz'), ('Audi'), ('BMW'),
  ('Chery'), ('Suzuki'), ('Dodge/RAM'), ('Hyundai'), ('Kia'), ('Iveco'), ('Scania'),
  ('Volvo'), ('Cummins'), ('MWM'), ('Perkins'), ('Maxion'), ('Deutz'), ('Pauny'),
  ('John Deere'), ('Massey Ferguson'), ('Valtra'), ('New Holland'), ('Zanello'),
  ('Case'), ('Universal')
on conflict (descripcion) do nothing;

-- Modelos por marca. "Genérico" se agrega para todas las marcas más abajo,
-- no hace falta repetirlo en cada lista.
insert into public.modelos_auto (id_marca_auto, descripcion)
select ma.id, t.modelo
from (values
  ('VW', 'Gol'), ('VW', 'Gol Trend'), ('VW', 'Amarok'), ('VW', 'Vento'), ('VW', 'Bora'),
  ('VW', 'Fox'), ('VW', 'Suran'), ('VW', 'Polo'), ('VW', 'Saveiro'), ('VW', 'Up!'),
  ('VW', 'Nivus'), ('VW', 'T-Cross'), ('VW', 'Taos'), ('VW', 'Constellation'),
  ('VW', 'Worker'), ('VW', 'Delivery'),

  ('Chevrolet', 'Corsa'), ('Chevrolet', 'Classic'), ('Chevrolet', 'Onix'),
  ('Chevrolet', 'Prisma'), ('Chevrolet', 'Cruze'), ('Chevrolet', 'S10'),
  ('Chevrolet', 'Tracker'), ('Chevrolet', 'Agile'), ('Chevrolet', 'Meriva'),
  ('Chevrolet', 'Spin'), ('Chevrolet', 'Aveo'), ('Chevrolet', 'Montana'),
  ('Chevrolet', 'Joy'),

  ('Fiat', 'Palio'), ('Fiat', 'Siena'), ('Fiat', 'Uno'), ('Fiat', 'Uno Fire'),
  ('Fiat', 'Cronos'), ('Fiat', 'Toro'), ('Fiat', 'Strada'), ('Fiat', 'Fiorino'),
  ('Fiat', 'Argo'), ('Fiat', 'Punto'), ('Fiat', 'Ducato'), ('Fiat', 'Mobi'),
  ('Fiat', 'Duna'), ('Fiat', 'Spazio'),

  ('Ford', 'Ka'), ('Ford', 'Fiesta'), ('Ford', 'Fiesta Kinetic'), ('Ford', 'Focus'),
  ('Ford', 'Ranger'), ('Ford', 'EcoSport'), ('Ford', 'F-100'), ('Ford', 'Transit'),
  ('Ford', 'Mondeo'), ('Ford', 'Escort'), ('Ford', 'Falcon'), ('Ford', 'Cargo 1722'),
  ('Ford', 'Cargo 1932'), ('Ford', 'F-4000'), ('Ford', 'F-350'),

  ('Renault', 'Clio'), ('Renault', 'Clio Mio'), ('Renault', 'Kangoo'),
  ('Renault', 'Sandero'), ('Renault', 'Logan'), ('Renault', 'Duster'),
  ('Renault', 'Megane'), ('Renault', 'Fluence'), ('Renault', 'Oroch'),
  ('Renault', 'Master'), ('Renault', 'Stepway'), ('Renault', 'R12'),
  ('Renault', 'R19'), ('Renault', 'R9'),

  ('Peugeot', '206'), ('Peugeot', '207'), ('Peugeot', '207 Compact'),
  ('Peugeot', '208'), ('Peugeot', '307'), ('Peugeot', '308'), ('Peugeot', '408'),
  ('Peugeot', 'Partner'), ('Peugeot', '2008'), ('Peugeot', '3008'), ('Peugeot', '504'),

  ('Citroen', 'C3'), ('Citroen', 'C4'), ('Citroen', 'C4 Lounge'),
  ('Citroen', 'Berlingo'), ('Citroen', 'C4 Cactus'), ('Citroen', 'Picasso'),

  ('Toyota', 'Hilux'), ('Toyota', 'Corolla'), ('Toyota', 'Etios'),
  ('Toyota', 'Yaris'), ('Toyota', 'SW4'), ('Toyota', 'RAV4'),

  ('Honda', 'Civic'), ('Honda', 'Fit'), ('Honda', 'HR-V'), ('Honda', 'CR-V'),
  ('Honda', 'City'),

  ('Nissan', 'Frontier'), ('Nissan', 'March'), ('Nissan', 'Versa'),
  ('Nissan', 'Kicks'), ('Nissan', 'Sentra'), ('Nissan', 'Tiida'),

  ('Jeep', 'Renegade'), ('Jeep', 'Compass'), ('Jeep', 'Grand Cherokee'),

  ('Mercedes Benz', 'Sprinter'), ('Mercedes Benz', 'Vito'), ('Mercedes Benz', 'Accelo'),
  ('Mercedes Benz', 'Atego'), ('Mercedes Benz', 'Axor'), ('Mercedes Benz', 'Actros'),
  ('Mercedes Benz', '1114'), ('Mercedes Benz', '1518'), ('Mercedes Benz', '1620'),
  ('Mercedes Benz', '1938'),

  ('Audi', 'A3'), ('Audi', 'A4'), ('Audi', 'A1'), ('Audi', 'Q3'), ('Audi', 'Q5'),

  ('BMW', 'Serie 1'), ('BMW', 'Serie 3'), ('BMW', 'X1'), ('BMW', 'X3'),

  ('Chery', 'Tiggo'), ('Chery', 'QQ'), ('Chery', 'Fulwin'),

  ('Suzuki', 'Fun'), ('Suzuki', 'Grand Vitara'), ('Suzuki', 'Swift'),

  ('Dodge/RAM', 'RAM 1500'), ('Dodge/RAM', 'RAM 2500'), ('Dodge/RAM', 'Journey'),
  ('Dodge/RAM', 'Dakota'),

  ('Hyundai', 'Tucson'), ('Hyundai', 'Santa Fe'), ('Hyundai', 'H1'),
  ('Hyundai', 'Creta'), ('Hyundai', 'i10'),

  ('Kia', 'Sportage'), ('Kia', 'Sorento'), ('Kia', 'K2500'), ('Kia', 'Cerato'),

  ('Iveco', 'Daily'), ('Iveco', 'Tector'), ('Iveco', 'Stralis'), ('Iveco', 'Cursor'),
  ('Iveco', 'EuroCargo'),

  ('Scania', 'Serie 4'), ('Scania', 'Serie 5'), ('Scania', 'G380'),
  ('Scania', 'R420'), ('Scania', '112'), ('Scania', '113'),

  ('Volvo', 'FH'), ('Volvo', 'FM'), ('Volvo', 'VM')
) as t(marca, modelo)
join public.marcas_auto ma on ma.descripcion = t.marca
on conflict (id_marca_auto, descripcion) do nothing;

-- Modelo "Genérico" para todas las marcas (incluida Universal), para
-- artículos que mencionan la marca/son genéricos pero sin modelo puntual.
insert into public.modelos_auto (id_marca_auto, descripcion)
select id, 'Genérico' from public.marcas_auto
on conflict (id_marca_auto, descripcion) do nothing;
