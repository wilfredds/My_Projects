import type { PrismaClient } from '@prisma/client';
import { notDeleted } from './jobs';

/**
 * The highest odometer reading recorded for each of these cars, in one query.
 * Readings only go up, so the highest is the latest that is worth showing as
 * a hint ("Huling naitala: 45,210 km").
 */
export async function lastOdometerByVehicle(
  db: PrismaClient,
  vehicleIds: string[],
  /** Leave one job out — the one being edited, so it is not its own hint. */
  excludeJobId?: string,
): Promise<Map<string, number>> {
  if (vehicleIds.length === 0) return new Map();
  const rows = await db.job.groupBy({
    by: ['vehicleId'],
    where: {
      ...notDeleted,
      vehicleId: { in: vehicleIds },
      odometerKm: { not: null },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
    },
    _max: { odometerKm: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._max.odometerKm !== null) map.set(row.vehicleId, row._max.odometerKm);
  }
  return map;
}
