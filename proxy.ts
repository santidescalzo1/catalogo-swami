import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/server'

export default async function proxy(request: NextRequest) {
  const { response, user, esAdmin } = await updateSession(request)
  const { pathname } = request.nextUrl

  // No alcanza con "hay sesion" (puede ser un cliente logueado desde el
  // catalogo publico) - hace falta ser admin.
  if (pathname !== '/admin/login' && !esAdmin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (pathname === '/admin/login' && user && esAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: '/admin/:path*',
}
