import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const signInPath = "/sign-in";
const signUpPath = "/sign-up";

const isProtectedRoute = createRouteMatcher([
    "/account(.*)",
    "/runs/new(.*)",
    "/admin(.*)",
]);

function signInUrlForRequest(req: Request) {
  const signInUrl = new URL(signInPath, req.url);
  signInUrl.searchParams.set("redirect_url", req.url);
  return signInUrl.toString();
}

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) {
        await auth.protect({
          unauthenticatedUrl: signInUrlForRequest(req),
        });
    }
  },
  {
    signInUrl: signInPath,
    signUpUrl: signUpPath,
    // No frontendApiProxy here on purpose. findopengym.com is a verified
    // Primary domain on the Clerk instance, so the browser reaches the Frontend
    // API directly at the host encoded in the pk_live_ key. Declaring a proxy
    // told Clerk the Frontend API lived at https://findopengym.com/__clerk,
    // which is a URL the instance has no record of, and Clerk rejected the
    // handshake with host_invalid.
    //
    // Leaving this unset also restores Clerk's automatic proxy for preview
    // deployments: clerkMiddleware only auto-enables it when no explicit
    // frontendApiProxy is given, and only for *.vercel.app hosts, which cannot
    // reach a Frontend API bound to a custom domain. That is the case the
    // feature exists for. Keep /__clerk in the matcher below so those previews
    // can still be served.
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    '/__clerk(.*)',
  ],
};
