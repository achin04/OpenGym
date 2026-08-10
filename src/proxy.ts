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
    frontendApiProxy: {
      enabled: (url) => url.hostname === "findopengym.com",
    },
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
