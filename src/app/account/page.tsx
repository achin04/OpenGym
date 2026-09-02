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

  await prisma.user.upsert({
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
    <main className="min-h-screen px-5 py-8 text-cream sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
            Account
          </p>
          <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
            Your OpenGym account
          </h1>
        </div>

        <div className="rounded-lg border border-line bg-ink-900/72 p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cream/38">Email</dt>
              <dd className="mt-1 text-cream">{email}</dd>
            </div>

            <div>
              <dt className="text-cream/38">Name</dt>
              <dd className="mt-1 text-cream">
                {clerkUser?.fullName ?? "No name found"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
