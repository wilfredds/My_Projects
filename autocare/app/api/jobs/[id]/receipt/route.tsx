import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { jobInclude, notDeleted, serializeJob } from '@/lib/jobs';
import { getShopInfo } from '@/lib/settings';
import { intlTagFor } from '@/i18n/locales';
import { ReceiptPdf, type ReceiptLabels } from '@/lib/pdf/receipt-pdf';

// @react-pdf/renderer and Prisma both need the Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Languages whose text the PDF's built-in fonts can draw. */
const PDF_LOCALES = new Set(['fil', 'en', 'es']);

function kmText(km: number, locale: string): string {
  return new Intl.NumberFormat(intlTagFor(locale)).format(km);
}

/**
 * GET /api/jobs/<id>/receipt — the downloadable PDF receipt.
 *
 * The session is re-checked here, not merely in the middleware: this endpoint
 * returns customer data and can be requested directly.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await params;

  // The PDF is set in Helvetica, which has no Japanese, Korean or Chinese
  // glyphs — those would print as blanks. Readers of those languages get the
  // PDF in English (the on-screen receipt stays in their language).
  const userLocale = await getLocale();
  const locale = PDF_LOCALES.has(userLocale) ? userLocale : 'en';

  const [job, shop, tr, tj] = await Promise.all([
    prisma.job.findFirst({ where: { id, ...notDeleted }, include: jobInclude }),
    getShopInfo(),
    getTranslations({ locale, namespace: 'receipt' }),
    getTranslations({ locale, namespace: 'job' }),
  ]);

  if (!job) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const serialized = serializeJob(job);

  const labels: ReceiptLabels = {
    jobNumber: tr('jobNumber'),
    date: tr('date'),
    customer: tr('customer'),
    vehicle: tr('vehicle'),
    servicesDone: tr('servicesDone'),
    spareParts: tr('spareParts'),
    item: tr('item'),
    qty: tr('qty'),
    unitPrice: tr('unitPrice'),
    amount: tr('amount'),
    labor: tr('labor'),
    expenses: tr('expenses'),
    subtotal: tr('subtotal'),
    discount: tr('discount'),
    total: tr('total'),
    amountPaid: tr('amountPaid'),
    balance: tr('balance'),
    paymentMethod: tr('paymentMethod'),
    paymentMethodValue: serialized.paymentMethod
      ? tj(`method_${serialized.paymentMethod}` as never)
      : '',
    status: tj('status'),
    statusValue: tj(`status_${serialized.status}` as never),
    notes: tr('notes'),
    thankYou: tr('thankYou'),
    servedBy: tr('servedBy'),
    tin: tr('tin'),
    notOfficial: tr('notOfficial'),
    odometer: tr('odometer'),
    nextVisit: tr('nextVisit'),
    nextVisitKm: serialized.nextVisitKm
      ? serialized.nextVisitOn
        ? tr('nextVisitKm', { km: kmText(serialized.nextVisitKm, locale) })
        : tr('nextVisitAtKm', { km: kmText(serialized.nextVisitKm, locale) })
      : '',
  };

  const buffer = await renderToBuffer(
    <ReceiptPdf
      job={serialized}
      shop={shop}
      labels={labels}
      intlTag={intlTagFor(locale)}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${job.jobNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
