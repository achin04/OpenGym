import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";


export default async function AccountPage() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        throw new Error("Expected a signed-in user");
    }
    
    const email = clerkUser.primaryEmailAddress?.emailAddress;

    if (!email) {
        throw new Error("Expected user to have a primary email address");
    }

    const appUser = await prisma.user.upsert({
        where: {
            clerkUserId: clerkUser.id,
        },
        update: {
            email,
            name: clerkUser.fullName,
        },
        create: {
            clerkUserId: clerkUser.id,
            email,
            name: clerkUser.fullName,
        },
    });

    return (
        <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <section className="mx-auto w-full max-w-5xl space-y-6">
            <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                Account
            </p>
            <h1 className="text-4xl font-semibold tracking-normal">
                Your OpenGym account
            </h1>
            <p className="max-w-2xl text-zinc-300">
                This page is protected. Only signed-in users should be able to see it.
            </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                <dt className="text-zinc-500">Clerk user ID</dt>
                <dd className="mt-1 text-zinc-100">{clerkUser?.id}</dd>
                </div>

                <div>
                <dt className="text-zinc-500">OpenGym user ID</dt>
                <dd className="mt-1 text-zinc-100">{appUser.id}</dd>
                </div>

                <div>
                <dt className="text-zinc-500">Email</dt>
                <dd className="mt-1 text-zinc-100">
                    {clerkUser?.primaryEmailAddress?.emailAddress ?? "No email found"}
                </dd>
                </div>

                <div>
                <dt className="text-zinc-500">Name</dt>
                <dd className="mt-1 text-zinc-100">
                    {clerkUser?.fullName ?? "No name found"}
                </dd>
                </div>
            </dl>
            </div>
        </section>
        </main>
  );
}