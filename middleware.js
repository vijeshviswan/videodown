import { NextResponse } from 'next/server';

export function middleware(request) {
    const authCookie = request.cookies.get('auth');
    const { pathname } = request.nextUrl;

    // Paths that don't require authentication
    const publicPaths = ['/login', '/api/auth', '/_next', '/favicon.ico'];

    // Check if the current path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

    // If not authenticated and trying to access a protected route
    if (!authCookie && !isPublicPath) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If authenticated and trying to access login page
    if (authCookie && pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
