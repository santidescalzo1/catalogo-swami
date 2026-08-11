-- Ejecutar en el SQL Editor de Supabase, DESPUES de descripcion-estandarizada.sql.
-- Precarga descripcion_estandarizada expandiendo abreviaturas conocidas,
-- para todo articulo que todavia no tenga una descripcion estandarizada
-- cargada a mano (no pisa nada de lo que ya se haya editado en el panel).
--
-- Cada abreviatura de esta lista fue verificada contra los datos reales
-- antes de incluirla (no es una lista generica): se revisaron muestras de
-- cada una para confirmar que siempre significa lo mismo en este catalogo,
-- y se corrio en seco (dry-run en Node contra los ~4125 articulos reales)
-- antes de escribir este archivo para confirmar que el resultado se ve
-- bien y no hay reemplazos superpuestos.
--
-- Quedaron afuera a proposito, por ambiguedad real encontrada al revisar:
--   DEL./TRAS./IZQ./DER. (delantero/delantera, trasero/trasera,
--     izquierdo/izquierda, derecho/derecha - depende del genero del
--     sustantivo que acompañan; se confirmo con datos reales que el
--     catalogo SI mezcla masculino y femenino, un reemplazo ciego a una
--     sola forma arruina la gramatica en la mitad de los casos)
--   COMP. (a veces "completo", a veces "completa")
--   REG. (a veces "regulador", a veces "regulable" - confirmado con dos
--     significados distintos en la muestra)
--   CARB., SELEC., CUADR., VEL. (significado o concordancia incierta con
--     pocas muestras, o problema de plural: "5 VEL." = "5 VELOCIDADES")
--   AMP., KG., AT., 8V/12V/16V, C/AA, S/AA, etc. (abreviaturas tecnicas
--     estandar de la industria, no son una inconsistencia a corregir)
-- Si aparece alguna abreviatura nueva que convenga sumar, se puede agregar
-- otro regexp_replace() siguiendo el mismo patron.
--
-- Idempotente: solo toca filas con descripcion_estandarizada IS NULL, y
-- solo si la descripcion realmente contiene alguna de estas abreviaturas
-- (si no, no tiene sentido duplicar el texto sin cambios).

update public.articulos
set descripcion_estandarizada =
  regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(descripcion, '\yCHEV\.', 'CHEVROLET', 'gi'), '\yPEUG\.', 'PEUGEOT', 'gi'), '\yPEU\.', 'PEUGEOT', 'gi'), '\yCITR\.', 'CITROEN', 'gi'), '\yREN\.', 'RENAULT', 'gi'), '\yIMP\.', 'IMPORTADO', 'gi'), '\yORIG\.', 'ORIGINAL', 'gi'), '\yJGO\.', 'JUEGO', 'gi'), '\yCOMB\.', 'COMBUSTIBLE', 'gi'), '\yLIQ\.', 'LIQUIDO', 'gi'), '\yREF\.', 'REFRIGERANTE', 'gi'), '\yDISTRIB\.', 'DISTRIBUCION', 'gi'), '\yDEP\.', 'DEPOSITO', 'gi'), '\yCALEF\.', 'CALEFACCION', 'gi'), '\yELECTROV\.', 'ELECTROVALVULA', 'gi'), '\yNAC\.', 'NACIONAL', 'gi'), '\yDIR\.', 'DIRECCION', 'gi'), '\yAUX\.', 'AUXILIAR', 'gi'), '\yADM\.', 'ADMISION', 'gi'), '\yIGN\.', 'IGNICION', 'gi'), '\yMANG\.', 'MANGUERA', 'gi'), '\yDIST\.', 'DISTRIBUCION', 'gi'), '\yREP\.', 'REPARACION', 'gi'), '\yBRAZ\.', 'BRAZO', 'gi'), '\yCIG\.', 'CIGÜEÑAL', 'gi'), '\yMULTIF\.', 'MULTIFUNCION', 'gi'), '\yACEL\.', 'ACELERADOR', 'gi'), '\yPRECAL\.', 'PRECALENTAMIENTO', 'gi'), '\yMULT\.', 'MULTIPLE', 'gi'), '\yINF\.', 'INFERIOR', 'gi'), '\ySUP\.', 'SUPERIOR', 'gi'), '\yALUM\.', 'ALUMINIO', 'gi'), '\yABRAZ\.', 'ABRAZADERA', 'gi'), '\yTEMP\.', 'TEMPERATURA', 'gi'), '\yENF\.', 'ENFRIADOR', 'gi'), '\yCPO\.', 'CUERPO', 'gi'), '\yLAT\.', 'LATERAL', 'gi'), '\yHIDR\.', 'HIDRAULICA', 'gi'), '\yELECT\.', 'ELECTRICO', 'gi')
where descripcion_estandarizada is null
  and descripcion ~* '\y(CHEV|PEUG|PEU|CITR|REN|IMP|ORIG|JGO|COMB|LIQ|REF|DISTRIB|DEP|CALEF|ELECTROV|NAC|DIR|AUX|ADM|IGN|MANG|DIST|REP|BRAZ|CIG|MULTIF|ACEL|PRECAL|MULT|INF|SUP|ALUM|ABRAZ|TEMP|ENF|CPO|LAT|HIDR|ELECT)\.';
