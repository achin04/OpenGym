import "dotenv/config";
import { PrismaClient, RunSourceType, SkillLevel, AgeGroup } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});


async function main() {
    const communityCenter = await prisma.venue.create({
        data: {
            name: "Downtown Community Center",
            addressLine1: "100 Queen Street West,",
            city: "Toronto",
            postalCode: "M5H 2N2",
        },
    });

    const universityGym = await prisma.venue.create({
        data: {
            name: "University Athletic Centre",
            addressLine1: "55 College Street",
            city: "Toronto",
            postalCode: "M5G 2B3",
        },
    });

    await prisma.run.create({
        data: {
            title: "Friday Night Open Run",
            description: "Join us for an evening of fun and fitness!",
            sourceType: RunSourceType.CITY,
            startTime: new Date("2024-07-05T19:00:00Z"),
            endTime: new Date("2024-07-05T21:00:00Z"),
            price: 10,
            skillLevel: SkillLevel.INTERMEDIATE,
            ageGroup: AgeGroup.ADULT,
            maxPlayers: 20,
            verified: true,
            sourceUrl: "https://www.toronto.ca/events/friday-night-open-run/",
            venueId: communityCenter.id,
        },
    });

    await prisma.run.create({
        data: {
        title: "Sunday University Pickup",
        description: "Indoor pickup basketball at the university gym.",
        sourceType: RunSourceType.UNIVERSITY,
        startTime: new Date("2026-06-07T15:00:00.000Z"),
        endTime: new Date("2026-06-07T17:00:00.000Z"),
        price: 5,
        skillLevel: SkillLevel.BEGINNER,
        ageGroup: AgeGroup.ADULT,
        maxPlayers: 16,
        verified: true,
        sourceUrl: "https://example.com/sunday-pickup",
        venueId: universityGym.id,
        },
    });       
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });