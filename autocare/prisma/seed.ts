/**
 * Seed script — `npm run seed`.
 *
 * Creates:
 *   * The two ADMIN accounts (RAUL V. SANTOS and Francis Wilfred Antiporda).
 *   * The starter service catalog.
 *   * Two sample customers, each with a vehicle and one completed job, so the
 *     dashboard and reports have something to show on first run.
 *
 * Safe to run more than once: everything is upserted by a natural key.
 *
 * The temporary passwords are printed to the console ONCE, here. They are never
 * stored in plaintext, never written to a file, and never logged again.
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

/**
 * Temporary passwords. Both admins are told to change theirs on first login
 * (Users page -> Change password). Override with env vars to seed your own.
 */
const ADMIN_PASSWORDS = {
  raul: process.env.SEED_RAUL_PASSWORD ?? 'HiOcten#2026raul',
  france: process.env.SEED_FRANCE_PASSWORD ?? 'HiOcten#2026france',
};

const SHOP = {
  name: 'HI-OCTEN CAR CARE SERVICES',
  address:
    'Blk 4 Lot 3, Villa Acacia St., Bayview Subd., Amaya I, Tanza, Cavite (going Starfish Beach)',
  phone: '09989800388',
};

/**
 * Starter catalog with sensible Philippine peso prices, and how often each
 * service should be repeated (what the Babalikan reminders work from).
 */
const SERVICES: {
  name: string;
  defaultPrice: string;
  remindAfterMonths?: number;
  remindAfterKm?: number;
}[] = [
  { name: 'Carwash', defaultPrice: '250.00' },
  { name: 'Oil Change', defaultPrice: '850.00', remindAfterMonths: 3, remindAfterKm: 5000 },
  { name: 'Engine Tune-up', defaultPrice: '1800.00', remindAfterMonths: 6, remindAfterKm: 10000 },
  { name: 'Brake Service', defaultPrice: '1200.00', remindAfterMonths: 6, remindAfterKm: 10000 },
  { name: 'Tire Change', defaultPrice: '400.00' },
  { name: 'Battery Replacement', defaultPrice: '500.00' },
  { name: 'Aircon Cleaning', defaultPrice: '1500.00', remindAfterMonths: 6 },
];

/** Mirrors lib/calc.ts. Kept local so the seed has no app-code dependency. */
function computeTotals(input: {
  labor: number;
  expenses: number;
  discount: number;
  amountPaid: number;
  parts: { quantity: number; unitPrice: number }[];
  services: { price: number }[];
}) {
  const c = (n: number) => Math.round(n * 100);
  const partsC = input.parts.reduce((s, p) => s + p.quantity * c(p.unitPrice), 0);
  const servicesC = input.services.reduce((s, v) => s + c(v.price), 0);
  const subtotalC = c(input.labor) + c(input.expenses) + partsC + servicesC;
  const totalC = subtotalC - c(input.discount);
  const paidC = c(input.amountPaid);
  const balanceC = totalC - paidC;

  const status: 'PAID' | 'UNPAID' | 'PARTIAL' =
    balanceC <= 0 ? 'PAID' : paidC === 0 ? 'UNPAID' : 'PARTIAL';

  return {
    subtotal: (subtotalC / 100).toFixed(2),
    total: (totalC / 100).toFixed(2),
    balance: (balanceC / 100).toFixed(2),
    status,
  };
}

async function main() {
  console.log('\n🔧 Seeding AutoCare…\n');

  // ------------------------------------------------------------- shop info
  await prisma.shopSetting.upsert({
    where: { id: 'shop' },
    create: { id: 'shop', ...SHOP },
    update: SHOP,
  });
  console.log(`   Shop settings  ✓  ${SHOP.name}`);

  // ---------------------------------------------------------- admin accounts
  const raul = await prisma.user.upsert({
    where: { username: 'raul' },
    create: {
      name: 'RAUL V. SANTOS',
      username: 'raul',
      role: 'ADMIN',
      locale: 'fil',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORDS.raul, BCRYPT_COST),
      // These starting passwords are printed below and live in the README, so
      // the account cannot be used until its owner picks a private one.
      mustChangePassword: true,
    },
    update: { name: 'RAUL V. SANTOS', role: 'ADMIN', isActive: true },
  });

  const france = await prisma.user.upsert({
    where: { username: 'france' },
    create: {
      name: 'Francis Wilfred Antiporda',
      username: 'france',
      role: 'ADMIN',
      locale: 'fil',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORDS.france, BCRYPT_COST),
      mustChangePassword: true,
    },
    update: { name: 'Francis Wilfred Antiporda', role: 'ADMIN', isActive: true },
  });
  console.log('   Admin accounts ✓  raul, france');

  // ------------------------------------------------------------- catalog
  const services = [];
  for (const service of SERVICES) {
    services.push(
      await prisma.service.upsert({
        where: { name: service.name },
        create: service,
        update: { defaultPrice: service.defaultPrice },
      }),
    );
  }
  console.log(`   Services       ✓  ${services.length} in the catalog`);

  // -------------------------------------------------- sample customers + jobs
  const samples = [
    {
      customer: {
        fullName: 'Mario Dela Cruz',
        phone: '09171234567',
        address: 'Amaya I, Tanza, Cavite',
      },
      vehicle: {
        plateNumber: 'ABC 1234',
        make: 'Toyota',
        model: 'Vios',
        year: 2018,
        color: 'Silver',
      },
      job: {
        serviceNames: ['Carwash', 'Oil Change'],
        parts: [{ partName: 'Oil Filter', quantity: 1, unitPrice: 320 }],
        labor: 200,
        expenses: 0,
        discount: 50,
        amountPaid: 0, // left UNPAID so the dashboard shows an outstanding balance
        paymentMethod: null as 'CASH' | 'GCASH' | 'OTHER' | null,
        daysAgo: 2,
      },
    },
    {
      customer: {
        fullName: 'Elena Bautista',
        phone: '09228887766',
        address: 'Bayview Subd., Tanza, Cavite',
      },
      vehicle: {
        plateNumber: 'XYZ 5678',
        make: 'Mitsubishi',
        model: 'Mirage',
        year: 2020,
        color: 'Red',
      },
      job: {
        serviceNames: ['Aircon Cleaning', 'Brake Service'],
        parts: [{ partName: 'Brake Pad (front set)', quantity: 1, unitPrice: 1450 }],
        labor: 350,
        expenses: 80,
        discount: 0,
        amountPaid: -1, // sentinel: pay in full, resolved below
        paymentMethod: 'GCASH' as const,
        daysAgo: 1,
      },
    },
    {
      // A change oil from about three months ago: now due back, so the
      // Babalikan list has someone on it in a fresh demo.
      customer: {
        fullName: 'Jun Reyes',
        phone: '09175550123',
        address: 'Sahud Ulan, Tanza, Cavite',
      },
      vehicle: {
        plateNumber: 'TQW 3310',
        make: 'Ford',
        model: 'Ranger',
        year: 2021,
        color: 'Gray',
      },
      job: {
        serviceNames: ['Oil Change'],
        parts: [{ partName: 'Oil Filter', quantity: 1, unitPrice: 320 }],
        labor: 150,
        expenses: 0,
        discount: 0,
        amountPaid: -1,
        paymentMethod: 'CASH' as const,
        daysAgo: 94,
      },
    },
  ];

  const odometers: Record<string, number> = {
    'ABC 1234': 45210,
    'XYZ 5678': 23880,
    'TQW 3310': 61500,
  };

  let created = 0;

  for (const sample of samples) {
    const customer = await prisma.customer.upsert({
      where: { id: `seed-${sample.vehicle.plateNumber.replace(/\s/g, '')}` },
      create: {
        id: `seed-${sample.vehicle.plateNumber.replace(/\s/g, '')}`,
        ...sample.customer,
        createdById: raul.id,
      },
      update: sample.customer,
    });

    const vehicle = await prisma.vehicle.upsert({
      where: { id: `seedv-${sample.vehicle.plateNumber.replace(/\s/g, '')}` },
      create: {
        id: `seedv-${sample.vehicle.plateNumber.replace(/\s/g, '')}`,
        customerId: customer.id,
        ...sample.vehicle,
      },
      update: sample.vehicle,
    });

    const chosen = services.filter((s) => sample.job.serviceNames.includes(s.name));
    const serviceLines = chosen.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      price: Number(s.defaultPrice),
    }));

    const provisional = computeTotals({
      labor: sample.job.labor,
      expenses: sample.job.expenses,
      discount: sample.job.discount,
      amountPaid: 0,
      parts: sample.job.parts,
      services: serviceLines,
    });

    const amountPaid =
      sample.job.amountPaid === -1 ? Number(provisional.total) : sample.job.amountPaid;

    const totals = computeTotals({
      labor: sample.job.labor,
      expenses: sample.job.expenses,
      discount: sample.job.discount,
      amountPaid,
      parts: sample.job.parts,
      services: serviceLines,
    });

    const date = new Date();
    date.setDate(date.getDate() - sample.job.daysAgo);

    const year = date.getFullYear();
    const counter = await prisma.jobCounter.upsert({
      where: { year },
      create: { year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const jobNumber = `JOB-${year}-${String(counter.lastNumber).padStart(4, '0')}`;

    const existing = await prisma.job.findFirst({
      where: { vehicleId: vehicle.id, date: { gte: new Date(date.toDateString()) } },
      select: { id: true },
    });

    if (existing) {
      // Give the counter its number back so re-running does not create gaps.
      await prisma.jobCounter.update({
        where: { year },
        data: { lastNumber: { decrement: 1 } },
      });
      continue;
    }

    // The next visit, from the shortest interval among the services done —
    // the same rule as lib/reminders.ts, kept local like computeTotals.
    const months = chosen
      .map((s) => s.remindAfterMonths)
      .filter((n): n is number => typeof n === 'number');
    const kms = chosen.map((s) => s.remindAfterKm).filter((n): n is number => typeof n === 'number');
    const odometerKm = odometers[sample.vehicle.plateNumber] ?? null;
    const nextVisitOn = months.length
      ? new Date(Date.UTC(date.getFullYear(), date.getMonth() + Math.min(...months), date.getDate()))
      : null;
    const nextVisitKm = odometerKm !== null && kms.length ? odometerKm + Math.min(...kms) : null;

    const data: Prisma.JobCreateInput = {
      jobNumber,
      odometerKm,
      nextVisitOn,
      nextVisitKm,
      customer: { connect: { id: customer.id } },
      vehicle: { connect: { id: vehicle.id } },
      mechanic: { connect: { id: raul.id } },
      createdBy: { connect: { id: france.id } },
      date,
      laborCharge: sample.job.labor.toFixed(2),
      expenses: sample.job.expenses.toFixed(2),
      discount: sample.job.discount.toFixed(2),
      subtotal: totals.subtotal,
      total: totals.total,
      amountPaid: amountPaid.toFixed(2),
      balance: totals.balance,
      status: totals.status,
      paymentMethod: sample.job.paymentMethod,
      notes: 'Sample job created by the seed script.',
      services: {
        create: serviceLines.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          price: s.price.toFixed(2),
        })),
      },
      parts: {
        create: sample.job.parts.map((p) => ({
          partName: p.partName,
          quantity: p.quantity,
          unitPrice: p.unitPrice.toFixed(2),
          lineTotal: (p.quantity * p.unitPrice).toFixed(2),
        })),
      },
    };

    await prisma.job.create({ data });
    created += 1;
  }

  console.log(`   Sample data    ✓  ${samples.length} customers, ${samples.length} vehicles, ${created} job(s)`);

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ADMIN LOGINS — write these down, then change them on first use  ║
╠══════════════════════════════════════════════════════════════════╣
║  RAUL V. SANTOS                                                  ║
║     username:  raul                                              ║
║     password:  ${ADMIN_PASSWORDS.raul.padEnd(50)}║
║                                                                  ║
║  Francis Wilfred Antiporda                                       ║
║     username:  france                                            ║
║     password:  ${ADMIN_PASSWORDS.france.padEnd(50)}║
╚══════════════════════════════════════════════════════════════════╝

  These passwords are shown ONCE. Only their bcrypt hashes are stored.
  Both accounts are flagged so the first login goes straight to My Account
  and asks for a password of your own before anything else opens.
`);
}

main()
  .catch((error) => {
    console.error('\n❌ Seeding failed:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
