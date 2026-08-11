// Matchea articulos.descripcion (y descripcion_estandarizada si existe)
// contra el diccionario de marcas/modelos de auto del cliente, y genera
// el SQL de asociaciones articulos_modelos_auto.
//
// Solo lee datos (usa la anon key, publica por diseño) - no escribe nada
// en la base. Correr con:
//   node --env-file=.env.local scripts/match-modelos-auto.mjs
//
// Regla de matching (conservadora a propósito, para minimizar falsos
// positivos con modelos cortos/numéricos como "206" o "112"):
//   - Se busca la marca (o sus alias) como palabra completa en el texto.
//   - Si la marca matchea, se busca el modelo más específico de esa marca
//     (los de nombre más largo primero, ej. "Gol Trend" antes que "Gol").
//     Si matchea alguno, se usa ese único modelo. Si no matchea ninguno,
//     se usa el modelo "Genérico" de esa marca.
//   - Un modelo NUNCA se busca sin que su marca también esté presente en
//     el texto, para no confundir modelos numéricos/cortos con medidas,
//     códigos, etc.
//   - Si ninguna marca matchea, el articulo va a "Universal" / "Genérico".

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TAXONOMIA = [
  { marca: 'VW', alias: ['VW', 'VOLKSWAGEN'], modelos: ['Gol Trend', 'Gol', 'Amarok', 'Vento', 'Bora', 'Fox', 'Suran', 'Polo', 'Saveiro', 'Up!', 'Nivus', 'T-Cross', 'Taos', 'Constellation', 'Worker', 'Delivery'] },
  { marca: 'Chevrolet', alias: ['CHEVROLET', 'CHEVY'], modelos: ['Corsa', 'Classic', 'Onix', 'Prisma', 'Cruze', 'S10', 'Tracker', 'Agile', 'Meriva', 'Spin', 'Aveo', 'Montana', 'Joy'] },
  { marca: 'Fiat', alias: ['FIAT'], modelos: ['Uno Fire', 'Palio', 'Siena', 'Uno', 'Cronos', 'Toro', 'Strada', 'Fiorino', 'Argo', 'Punto', 'Ducato', 'Mobi', 'Duna', 'Spazio'] },
  { marca: 'Ford', alias: ['FORD'], modelos: ['Fiesta Kinetic', 'Fiesta', 'Ka', 'Focus', 'Ranger', 'EcoSport', 'F-100', 'Transit', 'Mondeo', 'Escort', 'Falcon', 'Cargo 1722', 'Cargo 1932', 'F-4000', 'F-350'] },
  { marca: 'Renault', alias: ['RENAULT'], modelos: ['Clio Mio', 'Clio', 'Kangoo', 'Sandero', 'Logan', 'Duster', 'Megane', 'Fluence', 'Oroch', 'Master', 'Stepway', 'R12', 'R19', 'R9'] },
  { marca: 'Peugeot', alias: ['PEUGEOT'], modelos: ['207 Compact', '207', '206', '208', '307', '308', '408', 'Partner', '2008', '3008', '504'] },
  { marca: 'Citroen', alias: ['CITROEN', 'CITROËN'], modelos: ['C4 Lounge', 'C4 Cactus', 'C4', 'C3', 'Berlingo', 'Picasso'] },
  { marca: 'Toyota', alias: ['TOYOTA'], modelos: ['Hilux', 'Corolla', 'Etios', 'Yaris', 'SW4', 'RAV4'] },
  { marca: 'Honda', alias: ['HONDA'], modelos: ['Civic', 'Fit', 'HR-V', 'CR-V', 'City'] },
  { marca: 'Nissan', alias: ['NISSAN'], modelos: ['Frontier', 'March', 'Versa', 'Kicks', 'Sentra', 'Tiida'] },
  { marca: 'Jeep', alias: ['JEEP'], modelos: ['Grand Cherokee', 'Renegade', 'Compass'] },
  { marca: 'Mercedes Benz', alias: ['MERCEDES BENZ', 'MERCEDES', 'MB'], modelos: ['Sprinter', 'Vito', 'Accelo', 'Atego', 'Axor', 'Actros', '1114', '1518', '1620', '1938'] },
  { marca: 'Audi', alias: ['AUDI'], modelos: ['A3', 'A4', 'A1', 'Q3', 'Q5'] },
  { marca: 'BMW', alias: ['BMW'], modelos: ['Serie 1', 'Serie 3', 'X1', 'X3'] },
  { marca: 'Chery', alias: ['CHERY'], modelos: ['Tiggo', 'QQ', 'Fulwin'] },
  { marca: 'Suzuki', alias: ['SUZUKI'], modelos: ['Fun', 'Grand Vitara', 'Swift'] },
  { marca: 'Dodge/RAM', alias: ['DODGE', 'RAM'], modelos: ['RAM 1500', 'RAM 2500', 'Journey', 'Dakota'] },
  { marca: 'Hyundai', alias: ['HYUNDAI'], modelos: ['Tucson', 'Santa Fe', 'H1', 'Creta', 'i10'] },
  { marca: 'Kia', alias: ['KIA'], modelos: ['Sportage', 'Sorento', 'K2500', 'Cerato'] },
  { marca: 'Iveco', alias: ['IVECO'], modelos: ['Daily', 'Tector', 'Stralis', 'Cursor', 'EuroCargo'] },
  { marca: 'Scania', alias: ['SCANIA'], modelos: ['Serie 4', 'Serie 5', 'G380', 'R420', '112', '113'] },
  { marca: 'Volvo', alias: ['VOLVO'], modelos: ['FH', 'FM', 'VM'] },
  { marca: 'Cummins', alias: ['CUMMINS'], modelos: [] },
  { marca: 'MWM', alias: ['MWM'], modelos: [] },
  { marca: 'Perkins', alias: ['PERKINS'], modelos: [] },
  { marca: 'Maxion', alias: ['MAXION'], modelos: [] },
  { marca: 'Deutz', alias: ['DEUTZ'], modelos: [] },
  { marca: 'Pauny', alias: ['PAUNY'], modelos: [] },
  { marca: 'John Deere', alias: ['JOHN DEERE', 'DEERE'], modelos: [] },
  { marca: 'Massey Ferguson', alias: ['MASSEY FERGUSON', 'MASSEY'], modelos: [] },
  { marca: 'Valtra', alias: ['VALTRA'], modelos: [] },
  { marca: 'New Holland', alias: ['NEW HOLLAND'], modelos: [] },
  { marca: 'Zanello', alias: ['ZANELLO'], modelos: [] },
  { marca: 'Case', alias: ['CASE'], modelos: [] },
]

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordBoundaryRegex(term) {
  // \b no funciona bien con "!" al final (Up!) ni bordes no alfanumericos,
  // asi que armamos el limite a mano con lookaround.
  const escaped = escapeRegex(term.toUpperCase())
  return new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`)
}

const marcasCompiladas = TAXONOMIA.map(m => ({
  ...m,
  aliasRegex: m.alias.map(wordBoundaryRegex),
  modelosOrdenados: [...m.modelos].sort((a, b) => b.length - a.length).map(nombre => ({
    nombre,
    regex: wordBoundaryRegex(nombre),
  })),
}))

async function traerTodosLosArticulos() {
  const porPagina = 1000
  let desde = 0
  const todos = []
  for (;;) {
    const { data, error } = await supabase
      .from('articulos')
      .select('id, codigo, descripcion, descripcion_estandarizada')
      .range(desde, desde + porPagina - 1)
    if (error) throw error
    todos.push(...data)
    if (data.length < porPagina) break
    desde += porPagina
  }
  return todos
}

function matchear(texto) {
  const t = texto.toUpperCase()
  const resultados = []
  for (const marca of marcasCompiladas) {
    if (!marca.aliasRegex.some(r => r.test(t))) continue
    const modeloEspecifico = marca.modelosOrdenados.find(m => m.regex.test(t))
    resultados.push({ marca: marca.marca, modelo: modeloEspecifico ? modeloEspecifico.nombre : 'Genérico' })
  }
  return resultados
}

function sqlQuote(s) {
  return s.replace(/'/g, "''")
}

async function main() {
  const articulos = await traerTodosLosArticulos()

  const stats = new Map() // marca -> count
  const filas = [] // { codigo, marca, modelo }
  const muestraConMatch = []
  const muestraUniversal = []
  const muestraMultiple = []

  for (const a of articulos) {
    const texto = [a.descripcion, a.descripcion_estandarizada].filter(Boolean).join(' ')
    const matches = matchear(texto)

    if (matches.length === 0) {
      filas.push({ codigo: a.codigo, marca: 'Universal', modelo: 'Genérico' })
      stats.set('Universal', (stats.get('Universal') ?? 0) + 1)
      if (muestraUniversal.length < 15) muestraUniversal.push(a.descripcion)
      continue
    }

    for (const m of matches) {
      filas.push({ codigo: a.codigo, marca: m.marca, modelo: m.modelo })
      stats.set(m.marca, (stats.get(m.marca) ?? 0) + 1)
    }

    if (matches.length > 1 && muestraMultiple.length < 15) {
      muestraMultiple.push({ descripcion: a.descripcion, matches })
    } else if (muestraConMatch.length < 40) {
      muestraConMatch.push({ descripcion: a.descripcion, match: matches[0] })
    }
  }

  console.log(`\nTotal artículos procesados: ${articulos.length}`)
  console.log(`Total asociaciones generadas: ${filas.length}\n`)
  console.log('Por marca:')
  for (const [marca, count] of [...stats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${marca.padEnd(20)} ${count}`)
  }

  console.log('\n--- Muestra con match (marca + modelo específico o Genérico) ---')
  for (const s of muestraConMatch.slice(0, 25)) {
    console.log(`  [${s.match.marca} / ${s.match.modelo}]  ${s.descripcion}`)
  }

  console.log('\n--- Muestra con MÚLTIPLES marcas matcheadas (revisar con cuidado) ---')
  for (const s of muestraMultiple) {
    console.log(`  ${s.descripcion}`)
    for (const m of s.matches) console.log(`     -> ${m.marca} / ${m.modelo}`)
  }

  console.log('\n--- Muestra sin ninguna marca (cae en Universal) ---')
  for (const d of muestraUniversal) {
    console.log(`  ${d}`)
  }

  // Genera el SQL candidato (no se corre solo, es para revisar/aprobar).
  const values = filas.map(f => `('${sqlQuote(f.codigo)}', '${sqlQuote(f.marca)}', '${sqlQuote(f.modelo)}')`).join(',\n  ')
  const sql = `-- GENERADO por scripts/match-modelos-auto.mjs — revisar antes de correr.
-- Requiere haber corrido antes supabase/marca-modelo-auto.sql.
insert into public.articulos_modelos_auto (id_articulo, id_modelo_auto)
select a.id, mo.id
from (values
  ${values}
) as t(codigo, marca, modelo)
join public.articulos a on a.codigo = t.codigo
join public.marcas_auto ma on ma.descripcion = t.marca
join public.modelos_auto mo on mo.id_marca_auto = ma.id and mo.descripcion = t.modelo
on conflict do nothing;
`
  writeFileSync('supabase/marca-modelo-auto-asociaciones.sql', sql)
  console.log(`\nSQL candidato escrito en supabase/marca-modelo-auto-asociaciones.sql (${filas.length} filas). Todavía no está aprobado para correr.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
