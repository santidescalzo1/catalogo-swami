-- Ejecutar en el SQL Editor de Supabase, de arriba a abajo.
-- 1) Amplia el largo maximo de rubros.descripcion (estaba truncando a ~10 caracteres).
alter table public.rubros alter column descripcion type varchar(60);

-- 2) Tabla de categorias generales (rubro general) + relacion con los rubros actuales (subrubro).
create table if not exists public.categorias_generales (
  id serial primary key,
  descripcion text not null unique
);

insert into public.categorias_generales (descripcion) values
  ('AIRE ACONDICIONADO'),
  ('CARROCERIA Y EXTERIOR'),
  ('COMBUSTIBLE E INYECCION'),
  ('DISTRIBUCION Y CORREAS'),
  ('ELECTRICO Y ENCENDIDO'),
  ('EMBRAGUE Y TRANSMISION'),
  ('FRENOS'),
  ('HABITACULO E INTERIOR'),
  ('HERRAJES Y SUJECION'),
  ('ILUMINACION'),
  ('LIMPIAPARABRISAS'),
  ('LUBRICACION'),
  ('MANGUERAS Y CAÑERIAS'),
  ('MOTOR'),
  ('REFRIGERACION'),
  ('SIN CATEGORIA'),
  ('SUSPENSION Y DIRECCION'),
  ('VARIOS')
on conflict (descripcion) do nothing;

alter table public.rubros add column if not exists id_categoria_general integer references public.categorias_generales(id);

-- 3) Asignar cada rubro actual a su categoria general.
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'AIRE ACONDICIONADO') where id in (207, 29);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'CARROCERIA Y EXTERIOR') where id in (2, 133, 87, 206, 65, 61, 15, 226, 142, 202, 19, 82, 84);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'COMBUSTIBLE E INYECCION') where id in (9, 39, 48, 193, 104, 11, 92);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'DISTRIBUCION Y CORREAS') where id in (100, 101, 6, 115, 74, 156, 53);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'ELECTRICO Y ENCENDIDO') where id in (210, 194, 38, 4, 138, 46, 148, 134, 130, 108, 105, 122, 10, 167, 94, 67, 18, 209, 198, 43, 21, 140, 147, 36, 8, 23, 96, 16, 159, 5, 13, 91, 121, 222, 49, 125, 166, 221, 126, 31, 7, 33, 20, 113);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'EMBRAGUE Y TRANSMISION') where id in (165, 176, 204, 62, 145, 88, 76, 110, 41, 90, 171, 180);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'FRENOS') where id in (154, 187, 215, 127, 72, 192, 172);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'HABITACULO E INTERIOR') where id in (184, 182, 14, 186, 216, 163, 185, 66, 3, 214);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'HERRAJES Y SUJECION') where id in (135, 199, 191, 220, 56, 144, 98, 119);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'ILUMINACION') where id in (81, 17, 1, 205, 75);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'LIMPIAPARABRISAS') where id in (158, 225, 71, 161, 52, 40, 141, 24, 60);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'LUBRICACION') where id in (197, 155, 128, 63, 107, 57, 114, 153);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'MANGUERAS Y CAÑERIAS') where id in (131, 183, 50, 35, 86, 112, 42, 34, 160, 124, 151, 211);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'MOTOR') where id in (80, 103, 152, 123, 129, 89, 208, 58, 164, 200, 47, 224, 213, 79, 44, 45, 117, 85, 136, 189, 177, 95, 181, 97, 162, 201, 73, 179);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'REFRIGERACION') where id in (99, 26, 69, 27, 212, 111, 93, 25, 168, 169, 30);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'SIN CATEGORIA') where id in (0);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'SUSPENSION Y DIRECCION') where id in (195, 77, 139, 28, 78, 64, 132, 116, 170, 203, 174, 218, 217, 83, 120, 22, 106);
update public.rubros set id_categoria_general = (select id from public.categorias_generales where descripcion = 'VARIOS') where id in (137, 68, 12, 190, 223, 175, 54, 37, 70, 118, 55, 178, 102, 149, 196, 146, 219, 157, 150, 51, 188, 32, 59, 109, 173, 143);

-- 4) Nombres completos.
update public.rubros set descripcion = 'ALOJAMIENTO' where id = 68; -- era: ALOJAMIENT
update public.rubros set descripcion = 'AMORTIGUADOR' where id = 195; -- era: AMORTIGUAD
update public.rubros set descripcion = 'BOMBA DE ACEITE' where id = 155; -- era: BOMBADEACE
update public.rubros set descripcion = 'BOMBA DE EMBRAGUE' where id = 165; -- era: BOMBADEEMB
update public.rubros set descripcion = 'BOMBA DE DIRECCION' where id = 28; -- era: BOMBADIREC
update public.rubros set descripcion = 'BOMBA DE FRENO' where id = 154; -- era: BOMBAFRENO
update public.rubros set descripcion = 'BOMBA LAVAPARABRISAS' where id = 158; -- era: BOMBALAVAP
update public.rubros set descripcion = 'BOMBA DE AGUA' where id = 99; -- era: BOMBASDEAG
update public.rubros set descripcion = 'BOMBA DE COMBUSTIBLE' where id = 9; -- era: BOMBASDECO
update public.rubros set descripcion = 'BOMBA DE PRESION' where id = 190; -- era: BOMBASDEPR
update public.rubros set descripcion = 'BUJIA DE PRECALENTAMIENTO' where id = 138; -- era: BUJIAPRECA
update public.rubros set descripcion = 'BULBO DE DIRECCION' where id = 148; -- era: BULBODIREC
update public.rubros set descripcion = 'BULBO DE MARCHA' where id = 134; -- era: BULBOMARCH
update public.rubros set descripcion = 'BULBO DE PRESION' where id = 130; -- era: BULBOPRESI
update public.rubros set descripcion = 'BULBO DE STOP' where id = 108; -- era: BULBOSTOP
update public.rubros set descripcion = 'BULBO DE TEMPERATURA' where id = 105; -- era: BULBOTEMPE
update public.rubros set descripcion = 'CABLE DE EMBRAGUE' where id = 176; -- era: CABLEDEEMB
update public.rubros set descripcion = 'CABLE DE BUJIA' where id = 10; -- era: CABLESDEBU
update public.rubros set descripcion = 'CABLE ELECTRICO' where id = 167; -- era: CABLESELEC
update public.rubros set descripcion = 'CARCASA DE FILTRO' where id = 128; -- era: CARCAZAFIL
update public.rubros set descripcion = 'CARCASA SELECTORA DE CAJA' where id = 204; -- era: CARCAZASEL
update public.rubros set descripcion = 'CARCASA DE TERMOSTATO' where id = 67; -- era: CARCAZATER
update public.rubros set descripcion = 'CARTER DE ACEITE' where id = 63; -- era: CARTERDEAC
update public.rubros set descripcion = 'CENTRO DE LLANTA' where id = 64; -- era: CENTROLLAN
update public.rubros set descripcion = 'CINTA AISLANTE' where id = 18; -- era: CINTAAISLA
update public.rubros set descripcion = 'CONEXIONES' where id = 198; -- era: CONECCIONE
update public.rubros set descripcion = 'CONTACTORES' where id = 21; -- era: CONTACTORE
update public.rubros set descripcion = 'CORREA DE DISTRIBUCION' where id = 100; -- era: CORREADEDI
update public.rubros set descripcion = 'CORTACORRIENTE' where id = 140; -- era: CORTACORRI
update public.rubros set descripcion = 'CRAPODINA DE EMBRAGUE' where id = 62; -- era: CRAPODINAE
update public.rubros set descripcion = 'CUBRE PEDAL' where id = 182; -- era: CUBREPEDAL
update public.rubros set descripcion = 'CUBRE VOLANTE' where id = 14; -- era: CUBREVOLAN
update public.rubros set descripcion = 'CUERPO DE ACELERADOR' where id = 48; -- era: CUERPOSACE
update public.rubros set descripcion = 'DEFLECTOR' where id = 206; -- era: DEFLECTORE
update public.rubros set descripcion = 'DEPOSITO DE DIRECCION' where id = 132; -- era: DEPOSITODI
update public.rubros set descripcion = 'DEPOSITO LAVAPARABRISAS' where id = 225; -- era: DEPOSITOLA
update public.rubros set descripcion = 'DEPOSITO DE LIQUIDO DE FRENOS' where id = 54; -- era: DEPOSITOLI
update public.rubros set descripcion = 'DESTELLADOR' where id = 147; -- era: DESTELLADO
update public.rubros set descripcion = 'DISTRIBUIDOR' where id = 6; -- era: DISTRIBUID
update public.rubros set descripcion = 'ELECTROVALVULA' where id = 123; -- era: ELECTROVAL
update public.rubros set descripcion = 'ELECTROVENTILADOR' where id = 26; -- era: ELECTROVEN
update public.rubros set descripcion = 'EMBELLECEDOR' where id = 65; -- era: EMBELLECED
update public.rubros set descripcion = 'ENCAUZADOR DE AIRE' where id = 69; -- era: ENCAUZADOR
update public.rubros set descripcion = 'FILTRO DE ACEITE' where id = 107; -- era: FILTROACEI
update public.rubros set descripcion = 'FILTRO DE AIRE' where id = 129; -- era: FILTROAIRE
update public.rubros set descripcion = 'FILTRO DE COMBUSTIBLE' where id = 104; -- era: FILTROCOMB
update public.rubros set descripcion = 'FILTRO DE HABITACULO' where id = 186; -- era: FILTROHABI
update public.rubros set descripcion = 'GRIFO DE CALEFACCION' where id = 37; -- era: GRIFOSCALE
update public.rubros set descripcion = 'INTERCOOLER' where id = 212; -- era: INTERCOOLE
update public.rubros set descripcion = 'INTERRUPTOR' where id = 96; -- era: INTERRUPTO
update public.rubros set descripcion = 'JUEGO DE ABRAZADERAS' where id = 220; -- era: JGO.ABRAZ
update public.rubros set descripcion = 'JUEGO DE ANILLOS' where id = 208; -- era: JUEGOANILL
update public.rubros set descripcion = 'JUEGO DE CABLES' where id = 16; -- era: JUEGOCABLE
update public.rubros set descripcion = 'JUEGO DE CAPUCHONES' where id = 159; -- era: JUEGOCAPUC
update public.rubros set descripcion = 'JUEGO DE CARCASA' where id = 58; -- era: JUEGOCARCA
update public.rubros set descripcion = 'JUNTA DE BOMBA' where id = 164; -- era: JUNTABOMBA
update public.rubros set descripcion = 'JUNTAS DE BOMBA' where id = 47; -- era: JUNTASBOMB
update public.rubros set descripcion = 'JUNTA DE DESCARGA' where id = 224; -- era: JUNTASDESC
update public.rubros set descripcion = 'JUNTA DE MULTIPLE' where id = 213; -- era: JUNTASM
update public.rubros set descripcion = 'JUNTA DE RADIADOR' where id = 111; -- era: JUNTASRADI
update public.rubros set descripcion = 'JUNTA DE TAPA' where id = 79; -- era: JUNTASTAPA
update public.rubros set descripcion = 'JUNTA DE TERMOSTATO' where id = 110; -- era: JUNTASTERM
update public.rubros set descripcion = 'KIT DE EMBRAGUE' where id = 41; -- era: KITDEEMBRA
update public.rubros set descripcion = 'KIT DE LEDS' where id = 17; -- era: KITDELEDS
update public.rubros set descripcion = 'KIT DE DISTRIBUCION' where id = 115; -- era: KITDISTRIB
update public.rubros set descripcion = 'KIT DE HOMOCINETICA' where id = 90; -- era: KITHOMOCIN
update public.rubros set descripcion = 'KIT PALANCA LIMPIAPARABRISAS' where id = 71; -- era: KITLEVAPAL
update public.rubros set descripcion = 'KIT DE PALANCA' where id = 70; -- era: KITPALANCA
update public.rubros set descripcion = 'KIT DE REPARACION' where id = 118; -- era: KITREPARAC
update public.rubros set descripcion = 'LIQUIDO REFRIGERANTE' where id = 93; -- era: LIQUIDOREF
update public.rubros set descripcion = 'LLAVE DE LUCES' where id = 5; -- era: LLAVEDELUC
update public.rubros set descripcion = 'LLAVE LAVAPARABRISAS' where id = 161; -- era: LLAVELAVAP
update public.rubros set descripcion = 'LLAVE SACA BOCADO' where id = 56; -- era: LLAVESACAB
update public.rubros set descripcion = 'MANGUERA DE AGUA' where id = 50; -- era: MANGUERAAG
update public.rubros set descripcion = 'MANGUERA DE CALEFACCION' where id = 35; -- era: MANGUERACA
update public.rubros set descripcion = 'MANGUERA DE FILTRO' where id = 86; -- era: MANGUERAFI
update public.rubros set descripcion = 'MANGUERA DE RADIADOR' where id = 112; -- era: MANGUERARA
update public.rubros set descripcion = 'MANGUERA DE RESPIRACION' where id = 42; -- era: MANGUERARE
update public.rubros set descripcion = 'MANGUERA DE SERVOFRENO' where id = 34; -- era: MANGUERASC
update public.rubros set descripcion = 'MANGUERA DE VENTILACION' where id = 160; -- era: MANGUERAVE
update public.rubros set descripcion = 'MASTIL DE LIMPIAPARABRISAS' where id = 52; -- era: MASTILANTE
update public.rubros set descripcion = 'MAZA DE RUEDA' where id = 170; -- era: MAZASDERUE
update public.rubros set descripcion = 'MEDIDOR DE PRESION' where id = 55; -- era: MEDIDORPRE
update public.rubros set descripcion = 'MOTOR DE BOMBA LAVAPARABRISAS' where id = 40; -- era: MOTORBOMBA
update public.rubros set descripcion = 'MOTOR DE CALEFACCION' where id = 216; -- era: MOTORCALEF
update public.rubros set descripcion = 'MOTOR DE ARRANQUE' where id = 91; -- era: MOTORESARR
update public.rubros set descripcion = 'MOTOR PASO A PASO' where id = 44; -- era: MOTORESPAS
update public.rubros set descripcion = 'MOTOR LIMPIAPARABRISAS' where id = 141; -- era: MOTORLIMPI
update public.rubros set descripcion = 'PALANCA DE FRENO' where id = 127; -- era: PALANCAFRE
update public.rubros set descripcion = 'PALANCA LAVAPARABRISAS' where id = 24; -- era: PALANCALAV
update public.rubros set descripcion = 'PARRILLA DE SUSPENSION' where id = 174; -- era: PARRILLASD
update public.rubros set descripcion = 'PASTILLA DE FRENO' where id = 72; -- era: PASTILLASD
update public.rubros set descripcion = 'PEDAL DE ACELERADOR' where id = 163; -- era: PEDALACELE
update public.rubros set descripcion = 'PORTA TILLERIA' where id = 19; -- era: PORTATILLE
update public.rubros set descripcion = 'PUERTA TAPA COMBUSTIBLE' where id = 82; -- era: PUERTATAPA
update public.rubros set descripcion = 'PULMON DE AVANCE' where id = 192; -- era: PULMONAVAN
update public.rubros set descripcion = 'PUNTA DE EJE' where id = 171; -- era: PUNTASDEEJ
update public.rubros set descripcion = 'RAMPA DE INYECCION' where id = 92; -- era: RAMPAINYEC
update public.rubros set descripcion = 'REGULADORES' where id = 49; -- era: REGULADORE
update public.rubros set descripcion = 'REPARACION DE MULTIPLE' where id = 196; -- era: REPMULT
update public.rubros set descripcion = 'RESISTENCIA' where id = 166; -- era: RESISTENCI
update public.rubros set descripcion = 'RESONADOR' where id = 117; -- era: RESONADORE
update public.rubros set descripcion = 'ROSCA TAPA DE BALANCINES' where id = 57; -- era: ROSCATAPAB
update public.rubros set descripcion = 'SELECTOR DE CAJA' where id = 146; -- era: SELECTORCA
update public.rubros set descripcion = 'SONDA LAMBDA' where id = 7; -- era: SONDALAMBD
update public.rubros set descripcion = 'SOPORTE DE CABLE' where id = 157; -- era: SOPORTECAB
update public.rubros set descripcion = 'SOPORTE DE REGULADOR' where id = 33; -- era: SOPORTEREG
update public.rubros set descripcion = 'TAPA DE CILINDROS' where id = 177; -- era: TAPACILIND
update public.rubros set descripcion = 'TAPA DE DEPOSITO' where id = 51; -- era: TAPADEPOSI
update public.rubros set descripcion = 'TAPA DE DESCARGA' where id = 188; -- era: TAPADESCAR
update public.rubros set descripcion = 'TAPA DE VALVULAS' where id = 95; -- era: TAPADEVALV
update public.rubros set descripcion = 'TAPA DE DISTRIBUCION' where id = 156; -- era: TAPADISTRI
update public.rubros set descripcion = 'TAPA DE FARO' where id = 75; -- era: TAPAFARO
update public.rubros set descripcion = 'TAPA DE FILTRO' where id = 114; -- era: TAPAFILTRO
update public.rubros set descripcion = 'TAPA LAVAPARABRISAS' where id = 60; -- era: TAPALAVA
update public.rubros set descripcion = 'TAPA DE RADIADOR' where id = 168; -- era: TAPARADIAD
update public.rubros set descripcion = 'TAPA DE BOMBA' where id = 32; -- era: TAPASBOMBA
update public.rubros set descripcion = 'TAPAS DE DEPOSITO' where id = 59; -- era: TAPASDEPOS
update public.rubros set descripcion = 'TAPA DE LLENADO' where id = 109; -- era: TAPASLLENA
update public.rubros set descripcion = 'TAPA DE TERMOSTATO' where id = 169; -- era: TAPATERMOS
update public.rubros set descripcion = 'TAZA GRASERA' where id = 120; -- era: TAZAGRASER
update public.rubros set descripcion = 'TEMPORIZADOR' where id = 20; -- era: TEMPORIZAD
update public.rubros set descripcion = 'TRABA DE DIRECCION' where id = 22; -- era: TRABADIREC
update public.rubros set descripcion = 'TRABA DE VARILLA' where id = 143; -- era: TRABAVARIL
update public.rubros set descripcion = 'TUBO GUIA' where id = 124; -- era: TUBOGUIADE
update public.rubros set descripcion = 'VALVULA DE ACEITE' where id = 153; -- era: VALVULAACE
update public.rubros set descripcion = 'VALVULA ANTIRRETORNO' where id = 181; -- era: VALVULAANT
update public.rubros set descripcion = 'VALVULA DE CANISTER' where id = 97; -- era: VALVULACAN
update public.rubros set descripcion = 'VALVULA DE VENTILACION' where id = 73; -- era: VALVULAVEN
update public.rubros set descripcion = 'VOLANTE DE DIRECCION' where id = 214; -- era: VOLANTESD
update public.rubros set descripcion = 'VOLANTE DE MOTOR' where id = 179; -- era: VOLANTESMO

-- 5) Grant de lectura publica sobre la tabla nueva (igual que articulos/marcas/rubros).
grant select on public.categorias_generales to anon, authenticated;
alter table public.categorias_generales enable row level security;
drop policy if exists "lectura_publica" on public.categorias_generales;
create policy "lectura_publica" on public.categorias_generales for select to public using (true);
