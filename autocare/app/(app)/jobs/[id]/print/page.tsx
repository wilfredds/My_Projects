import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { jobInclude, notDeleted, serializeJob } from '@/lib/jobs';
import { getShopInfo } from '@/lib/settings';
import { ReceiptView } from '@/components/receipt/receipt-view';
import { PrintControls } from './print-controls';

export const dynamic = 'force-dynamic';

/**
 * The print-styled receipt view (the browser-print fallback to the PDF).
 *
 * There is no app shell on this route, and `@media print` in globals.css strips
 * the remaining buttons, so what comes out of the printer is only the receipt.
 */
export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const [job, shop, tcom] = await Promise.all([
    prisma.job.findFirst({ where: { id, ...notDeleted }, include: jobInclude }),
    getShopInfo(),
    getTranslations('common'),
  ]);

  if (!job) notFound();

  return (
    <div className="min-h-screen bg-background py-6">
      <PrintControls
        backHref={`/jobs/${job.id}`}
        printLabel={tcom('print')}
        backLabel={tcom('goBack')}
        downloadLabel={tcom('downloadPdf')}
        downloadHref={`/api/jobs/${job.id}/receipt`}
        fileName={`${job.jobNumber}.pdf`}
      />
      <div className="px-4">
        <ReceiptView job={serializeJob(job)} shop={shop} />
      </div>
    </div>
  );
}
