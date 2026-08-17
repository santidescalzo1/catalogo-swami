import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Hay sesion valida (user) no alcanza para dejar entrar a /admin: desde
  // que existe login de clientes en el catalogo publico, "hay sesion"
  // puede ser perfectamente un cliente logueado, no el admin. Se chequea
  // pertenencia explicita a la tabla admins (ver supabase/admins-clientes-y-seguridad.sql).
  let esAdmin = false
  if (user) {
    const { data } = await supabase.from('admins').select('id').eq('id', user.id).maybeSingle()
    esAdmin = !!data
  }

  return { response, user, esAdmin }
}
