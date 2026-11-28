import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { decimalToNumber, toCsv, startOfDay, endOfDay } from '@/lib/utils';
import { describeVehicle, notDeleted } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/export?format=csv|json — the owner's own backup (P1).
 *
 * ADMIN only, re-checked here. CSV exports the jobs ledger (one row per job);
 * JSON exports the whole dataset so it could be restored elsewhere.
 * Password hashes are never included.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!can.exportData(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';

  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  const where =
    (from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))
      ? {
          date: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: startOfDay(from) } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: endOfDay(to) } : {}),
          },
        }
      : {};

  // Deleted jobs are excluded from the backup: it mirrors what the shop
  // actually has on the books.
  const jobs = await prisma.job.findMany({
    where: { ...where, ...notDeleted },
    orderBy: { date: 'asc' },
    include: {
      customer: true,
      vehicle: true,
      parts: true,
      services: true,
      mechanic: { select: { name: true } },
      createdBy: { select: { name: true } },
      // Every payment towards the job, with the day it arrived (JSON backup).
      payments: { orderBy: { createdAt: 'asc' } },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  await audit({
    userId: user.id,
    action: 'EXPORT_DATA',
    entity: 'Job',
    metadata: { format, count: jobs.length },
  });

  if (format === 'json') {
    const [customers, vehicles, services] = await Promise.all([
      prisma.customer.findMany({ orderBy: { fullName: 'asc' } }),
      prisma.vehicle.findMany({ orderBy: { plateNumber: 'asc' } }),
      prisma.service.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.username,
      customers,
      vehicles,
      services,
      jobs,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="autocare-backup-${stamp}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const csv = toCsv(
    [
      'Job Number',
      'Date',
      'Customer',
      'Phone',
      'Vehicle',
      'Services',
      'Spare Parts',
      'Labor',
      'Expenses',
      'Discount',
      'Subtotal',
      'Total',
      'Amount Paid',
      'Balance',
      'Status',
      'Payment Method',
      'Mechanic',
      'Recorded By',
      'Notes',
      // Added later; kept at the end so existing spreadsheets still line up.
      'Odometer (km)',
      'Next Visit',
      'Next Visit (km)',
    ],
    jobs.map((job) => [
      job.jobNumber,
      job.date.toISOString().slice(0, 10),
      job.customer.fullName,
      job.customer.phone ?? '',
      describeVehicle(job.vehicle),
      job.services.map((s) => `${s.serviceName} (${decimalToNumber(s.price).toFixed(2)})`).join('; '),
      job.parts
        .map((p) => `${p.partName} x${p.quantity} (${decimalToNumber(p.lineTotal).toFixed(2)})`)
        .join('; '),
      decimalToNumber(job.laborCharge).toFixed(2),
      decimalToNumber(job.expenses).toFixed(2),
      decimalToNumber(job.discount).toFixed(2),
      decimalToNumber(job.subtotal).toFixed(2),
      decimalToNumber(job.total).toFixed(2),
      decimalToNumber(job.amountPaid).toFixed(2),
      decimalToNumber(job.balance).toFixed(2),
      job.status,
      job.paymentMethod ?? '',
      job.mechanic?.name ?? '',
      job.createdBy?.name ?? '',
      job.notes ?? '',
      job.odometerKm ?? '',
      job.nextVisitOn ? job.nextVisitOn.toISOString().slice(0, 10) : '',
      job.nextVisitKm ?? '',
    ]),
  );

  // The BOM makes Excel open UTF-8 (and the peso sign) correctly.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="autocare-jobs-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
