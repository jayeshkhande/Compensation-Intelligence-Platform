import { PrismaClient } from "@prisma/client";
import { resolveCompany } from "../lib/normalization";
import { calculateTotalComp } from "../lib/compensation";

const prisma = new PrismaClient();

// Intentionally includes multiple raw spellings of the same company
// ("Google", "Google India", "GOOGLE LLC") to exercise the normalization
// pipeline during seeding, exactly like real ingested data would.
const rawRecords = [
  { company: "Google", role: "Software Engineer", level: "L3", location: "Bengaluru", baseSalary: 2200000, bonus: 200000, stock: 400000, experienceYears: 1 },
  { company: "Google India", role: "Software Engineer", level: "L4", location: "Bengaluru", baseSalary: 3200000, bonus: 400000, stock: 800000, experienceYears: 3 },
  { company: "GOOGLE LLC", role: "Software Engineer", level: "L5", location: "Hyderabad", baseSalary: 4200000, bonus: 600000, stock: 1500000, experienceYears: 6 },
  { company: "Google", role: "Data Scientist", level: "L4", location: "Bengaluru", baseSalary: 3000000, bonus: 350000, stock: 700000, experienceYears: 3 },

  { company: "Microsoft", role: "Software Engineer", level: "59", location: "Hyderabad", baseSalary: 1900000, bonus: 150000, stock: 300000, experienceYears: 1 },
  { company: "Microsoft India Pvt Ltd", role: "Software Engineer", level: "62", location: "Hyderabad", baseSalary: 3000000, bonus: 300000, stock: 700000, experienceYears: 3 },
  { company: "Microsoft", role: "Software Engineer", level: "63", location: "Bengaluru", baseSalary: 4000000, bonus: 500000, stock: 1200000, experienceYears: 6 },
  { company: "Microsoft", role: "Product Manager", level: "62", location: "Bengaluru", baseSalary: 3200000, bonus: 350000, stock: 800000, experienceYears: 4 },

  { company: "Amazon", role: "Software Engineer", level: "SDE1", location: "Bengaluru", baseSalary: 1800000, bonus: 100000, stock: 300000, experienceYears: 1 },
  { company: "Amazon.com", role: "Software Engineer", level: "SDE2", location: "Hyderabad", baseSalary: 2600000, bonus: 200000, stock: 600000, experienceYears: 3 },
  { company: "Amazon", role: "Software Engineer", level: "SDE3", location: "Bengaluru", baseSalary: 3600000, bonus: 400000, stock: 1000000, experienceYears: 6 },
  { company: "Amazon", role: "Data Scientist", level: "SDE2", location: "Chennai", baseSalary: 2400000, bonus: 180000, stock: 500000, experienceYears: 3 },

  { company: "Flipkart", role: "Software Engineer", level: "SE2", location: "Bengaluru", baseSalary: 2000000, bonus: 100000, stock: 250000, experienceYears: 2 },
  { company: "Flipkart", role: "Software Engineer", level: "SE3", location: "Bengaluru", baseSalary: 2800000, bonus: 200000, stock: 500000, experienceYears: 4 },

  { company: "Meta", role: "Software Engineer", level: "E4", location: "Bengaluru", baseSalary: 4500000, bonus: 500000, stock: 2000000, experienceYears: 4 },
  { company: "Meta Platforms", role: "Software Engineer", level: "E5", location: "Bengaluru", baseSalary: 6000000, bonus: 800000, stock: 3500000, experienceYears: 7 },

  { company: "Zoho", role: "Software Engineer", level: "Member Technical Staff", location: "Chennai", baseSalary: 1200000, bonus: 50000, stock: 0, experienceYears: 2 },
  { company: "Zoho Corporation", role: "Software Engineer", level: "Senior MTS", location: "Chennai", baseSalary: 1800000, bonus: 100000, stock: 0, experienceYears: 5 },

  { company: "Swiggy", role: "Software Engineer", level: "SDE2", location: "Bengaluru", baseSalary: 2500000, bonus: 150000, stock: 400000, experienceYears: 3 },
  { company: "Swiggy", role: "Data Analyst", level: "Analyst II", location: "Bengaluru", baseSalary: 1500000, bonus: 80000, stock: 100000, experienceYears: 2 },
];

async function main() {
  console.log(`Seeding ${rawRecords.length} salary records...`);

  for (const r of rawRecords) {
    const company = await resolveCompany(r.company);
    const totalComp = calculateTotalComp(r.baseSalary, r.bonus, r.stock);

    await prisma.salaryRecord.upsert({
      where: {
        duplicate_key: {
          companyId: company.id,
          role: r.role,
          level: r.level,
          location: r.location,
          source: "seed",
        },
      },
      update: {},
      create: {
        companyId: company.id,
        role: r.role,
        level: r.level,
        location: r.location,
        baseSalary: r.baseSalary,
        bonus: r.bonus,
        stock: r.stock,
        totalComp,
        experienceYears: r.experienceYears,
        source: "seed",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
