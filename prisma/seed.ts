import "dotenv/config";
import { PrismaClient, RunSourceType, SkillLevel, AgeGroup } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const TORONTO_DROP_IN_SOURCE_URL = "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";
const TORONTO_DROP_IN_PROVIDER_KEY = "toronto-drop-in";
const TORONTO_DROP_IN_DATASET_ID = "1a5be46a-4039-48cd-a2d2-8e702abf9516";

async function main() {
    await prisma.scheduleSource.upsert({
        where: {
            url: TORONTO_DROP_IN_SOURCE_URL,
        },
        update: {
            name: "City of Toronto Drop-In",
            sourceType: RunSourceType.CITY,
            notes: "Registered Programs and Drop In Courses Offering dataset, filtered to basketball drop-in records.",
            providerKey: TORONTO_DROP_IN_PROVIDER_KEY,
            externalDatasetId: TORONTO_DROP_IN_DATASET_ID,
            attributionText: "Contains information made available by the City of Toronto Open Data program.",
            licenseUrl: "https://open.toronto.ca/open-data-license/",
            config: {
                packageId: TORONTO_DROP_IN_DATASET_ID,
                resources: {
                    dropIn: "c99ec04f-4540-482c-9ee4-efb38774eab4",
                    locations: "f23ac1ad-6f46-4b59-811f-eb34be9b1f7a",
                    facilities: "e16505dc-f106-4b58-a689-ed0a2b8b0b69",
                    registeredPrograms: "3bdfdad5-b1d0-4b1b-b56d-c61c317da306",
                },
                basketballCourseTitles: [
                    "Basketball",
                    "Basketball (Girls)",
                    "Basketball (Men)",
                    "Basketball (Women)",
                    "Basketball with Family",
                    "Parasport: Wheelchair Basketball",
                ],
            },
        },
        create: {
            name: "City of Toronto Drop-In",
            sourceType: RunSourceType.CITY,
            url: TORONTO_DROP_IN_SOURCE_URL,
            notes: "Registered Programs and Drop In Courses Offering dataset, filtered to basketball drop-in records.",
            providerKey: TORONTO_DROP_IN_PROVIDER_KEY,
            externalDatasetId: TORONTO_DROP_IN_DATASET_ID,
            attributionText: "Contains information made available by the City of Toronto Open Data program.",
            licenseUrl: "https://open.toronto.ca/open-data-license/",
            config: {
                packageId: TORONTO_DROP_IN_DATASET_ID,
                resources: {
                    dropIn: "c99ec04f-4540-482c-9ee4-efb38774eab4",
                    locations: "f23ac1ad-6f46-4b59-811f-eb34be9b1f7a",
                    facilities: "e16505dc-f106-4b58-a689-ed0a2b8b0b69",
                    registeredPrograms: "3bdfdad5-b1d0-4b1b-b56d-c61c317da306",
                },
                basketballCourseTitles: [
                    "Basketball",
                    "Basketball (Girls)",
                    "Basketball (Men)",
                    "Basketball (Women)",
                    "Basketball with Family",
                    "Parasport: Wheelchair Basketball",
                ],
            },
        },
    });

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
