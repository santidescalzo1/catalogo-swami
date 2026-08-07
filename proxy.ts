import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/server'

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (pathname !== '/admin/login' && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (pathname === '/admin/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: '/admin/:path*',
}
