import { PrismaClient, SourceType, SkillLevel, AgeGroup } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
    const communityCenter = await prisma.venue.create({
        data: {
            name: "Downtown Community Center",
            address: "100 Queen Street West,",
            city: "Toronto",
            province: "ON",
            postalCode: "M5H 2N2",
        },
    });

    const universityGym = await prisma.venue.create({
        data: {
            name: "University Athletic Centre",
            address: "55 College Street",
            city: "Toronto",
            province: "ON",
            postalCode: "M5G 2B3",
        },
    });
        
}