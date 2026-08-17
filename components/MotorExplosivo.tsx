'use client'

import { useEffect, useRef, useState } from 'react'

interface Pieza {
  id: string
  exploded: string
  assembled: string
  delayMs: number
  children: React.ReactNode
}

const HEX_BOLT = (cx: number, cy: number, r: number) => {
  const puntos = Array.from({ length: 6 }, (_, i) => {
    const ang = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`
  }).join(' ')
  return <polygon points={puntos} />
}

const DIENTES_ENGRANAJE = (cx: number, cy: number, r: number, dienteAlto: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const ang = (Math.PI * 2 * i) / 10
    const x1 = (cx + r * Math.cos(ang)).toFixed(2)
    const y1 = (cy + r * Math.sin(ang)).toFixed(2)
    const x2 = (cx + (r + dienteAlto) * Math.cos(ang)).toFixed(2)
    const y2 = (cy + (r + dienteAlto) * Math.sin(ang)).toFixed(2)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
  })

export default function MotorExplosivo() {
  const seccionRef = useRef<HTMLDivElement>(null)
  const [armado, setArmado] = useState(false)

  useEffect(() => {
    const nodo = seccionRef.current
    if (!nodo) return

    // Se arma al entrar en pantalla y se desarma al salir, cada vez que
    // pase — no queda "conectado" una sola vez como antes.
    const observer = new IntersectionObserver(
      (entradas) => {
        setArmado(!!entradas[0]?.isIntersecting)
      },
      { threshold: 0.35 }
    )
    observer.observe(nodo)
    return () => observer.disconnect()
  }, [])

  // Piezas del motor: cada una nace "explotada" lejos del bloque y converge
  // a su posicion real cuando la seccion entra en pantalla. El orden de
  // ensamblado (pistones -> arbol de levas -> polea -> carter -> bulones ->
  // llave) sigue el orden real en el que un mecanico arma un motor.
  const piezas: Pieza[] = [
    // 4 pistones
    ...[0, 1, 2, 3].map((i) => {
      const x = 203 + i * 25
      return {
        id: `piston-${i}`,
        exploded: `translate(${-10 + i * 6}px, -150px) rotate(${-8 + i * 4}deg)`,
        assembled: 'translate(0px, 0px) rotate(0deg)',
        delayMs: 80 + i * 90,
        children: (
          <g key={`piston-${i}`}>
            <circle cx={x} cy={72} r={9} />
            <rect x={x - 4} y={81} width={8} height={26} />
          </g>
        ),
      }
    }),
    {
      id: 'arbol-levas',
      exploded: 'translate(150px, -110px) rotate(-35deg)',
      assembled: 'translate(0px, 0px) rotate(0deg)',
      delayMs: 460,
      children: (
        <g>
          <circle cx={240} cy={54} r={17} />
          {DIENTES_ENGRANAJE(240, 54, 17, 6)}
          <circle cx={240} cy={54} r={4} />
        </g>
      ),
    },
    {
      id: 'polea',
      exploded: 'translate(-20px, 170px) rotate(55deg)',
      assembled: 'translate(0px, 0px) rotate(0deg)',
      delayMs: 560,
      children: (
        <g>
          <circle cx={240} cy={252} r={22} />
          <line x1={240} y1={232} x2={240} y2={272} />
          <line x1={221} y1={241} x2={259} y2={263} />
          <line x1={221} y1={263} x2={259} y2={241} />
          <circle cx={240} cy={252} r={5} />
        </g>
      ),
    },
    {
      id: 'carter',
      exploded: 'translate(-165px, 55px) rotate(-16deg)',
      assembled: 'translate(0px, 0px) rotate(0deg)',
      delayMs: 640,
      children: <rect x={196} y={222} width={88} height={20} rx={4} />,
    },
    // 4 bulones en las esquinas del bloque
    ...[
      { cx: 194, cy: 112, dx: -85, dy: -70 },
      { cx: 286, cy: 112, dx: 85, dy: -70 },
      { cx: 194, cy: 224, dx: -85, dy: 70 },
      { cx: 286, cy: 224, dx: 85, dy: 70 },
    ].map((b, i) => ({
      id: `bulon-${i}`,
      exploded: `translate(${b.dx}px, ${b.dy}px) rotate(${i % 2 === 0 ? -40 : 40}deg)`,
      assembled: 'translate(0px, 0px) rotate(0deg)',
      delayMs: 720 + i * 60,
      children: <g key={`bulon-${i}`}>{HEX_BOLT(b.cx, b.cy, 6)}</g>,
    })),
    {
      id: 'llave',
      exploded: 'translate(210px, 210px) rotate(70deg)',
      assembled: 'translate(0px, 0px) rotate(18deg)',
      delayMs: 980,
      children: (
        <path d="M300 250 l34 34 m-8 -42 a12 12 0 1 1 -17 17 l-40 -40 a12 12 0 1 1 17 -17z" fill="none" />
      ),
    },
  ]

  return (
    <section
      ref={seccionRef}
      className="relative border-t border-zinc-200 bg-gradient-to-b from-transparent via-orange-50/50 to-transparent overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-[10px] text-orange-600 tracking-[0.3em] uppercase">Ingeniería a la vista</span>
          <h2 className="text-3xl sm:text-4xl font-light text-zinc-900 leading-tight mt-3 mb-5">
            Motor por motor,<br />pieza por pieza.
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-md">
            Así de ordenado tenemos el catálogo: cada repuesto clasificado y listo
            para encontrarse, para que tu próximo trabajo arranque sin vueltas.
          </p>
          <button
            onClick={() => seccionRef.current?.previousElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-8 text-[11px] uppercase tracking-[0.2em] text-zinc-500 hover:text-orange-600 border border-zinc-200 hover:border-orange-500/50 px-5 py-3 transition-colors"
          >
            Volver al catálogo ↑
          </button>
        </div>

        <div className="relative aspect-[3/2] w-full max-w-lg mx-auto">
          <svg
            viewBox="0 0 480 320"
            className="w-full h-full overflow-visible"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Bloque del motor: pieza ancla, no se mueve */}
            <g className="text-slate-500/80">
              <rect x={190} y={104} width={100} height={126} rx={8} />
              <rect x={198} y={88} width={84} height={18} rx={4} />
            </g>

            {piezas.map((pieza) => (
              <g
                key={pieza.id}
                className={`motor-pieza ${pieza.id === 'llave' ? 'text-orange-600/80' : 'text-zinc-500'}`}
                style={{
                  transform: armado ? pieza.assembled : pieza.exploded,
                  transitionProperty: 'transform',
                  transitionDuration: '900ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${pieza.delayMs}ms`,
                  transformOrigin: 'center',
                }}
              >
                {pieza.children}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  )
}
