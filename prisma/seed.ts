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

/*
 * Stable ids for the seeded rows, so this script can upsert.
 *
 * Seeding has to be idempotent -- `npm run seed` is run casually and more than
 * once -- and upsert needs something unique to match on. Venue has no natural
 * key: only `id`, with no unique constraint on name or address. Adding one
 * would mean a migration, and it would fail to apply anywhere duplicates
 * already exist, which is exactly the mess the old create() calls left behind.
 *
 * Literal ids sidestep both. They are also self-describing in a way a cuid is
 * not: anything prefixed `seed-` came from this file rather than from a real
 * import or a person, which makes it safe to recognise and safe to delete.
 *
 * ScheduleSource is the exception below -- its `url` is already unique, so it
 * upserts on the real key rather than a synthetic one.
 */
const SEED_VENUE_ID = "seed-downtown-community-center";
const SEED_RUN_ID = "seed-friday-night-open-run";

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

    const venueFields = {
        name: "Downtown Community Center",
        addressLine1: "100 Queen Street West,",
        city: "Toronto",
        postalCode: "M5H 2N2",
    };

    const communityCenter = await prisma.venue.upsert({
        where: { id: SEED_VENUE_ID },
        update: venueFields,
        create: { id: SEED_VENUE_ID, ...venueFields },
    });

    /*
     * Coordinates are deliberately absent from both branches. They are filled
     * in by geocoding, by hand in the admin, or by the backfill, and listing
     * them in `update` would mean every re-seed wiped whatever had been found
     * or corrected since the last one.
     */
    const runFields = {
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
    };

    await prisma.run.upsert({
        where: { id: SEED_RUN_ID },
        update: runFields,
        create: { id: SEED_RUN_ID, ...runFields },
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
