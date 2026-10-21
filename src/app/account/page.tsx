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
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
            Account
          </p>
          <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
            Your OpenGym account
          </h1>
        </div>

        <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] sm:p-8">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground/55">Email</dt>
              <dd className="mt-1 text-foreground">{email}</dd>
            </div>

            <div>
              <dt className="text-foreground/55">Name</dt>
              <dd className="mt-1 text-foreground">
                {clerkUser?.fullName ?? "No name found"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
