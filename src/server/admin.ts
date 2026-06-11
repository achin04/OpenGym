import { currentUser } from "@clerk/nextjs/server";

function getAdminEmails() {
    return (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export async function requireAdmin() {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        throw new Error(" You must be signed in.");
    }
    
    const email = clerkUser.primaryEmailAddress?.emailAddress.toLowerCase();

    if (!email || !getAdminEmails().includes(email)) {
        throw new Error(" You must be an admin.");
    }

    return clerkUser;
}