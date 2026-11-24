import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { formatPeso } from '@/lib/calc';
import { formatDate } from '@/lib/utils';
import { describeVehicle, type SerializedJob } from '@/lib/jobs';
import type { ShopInfo } from '@/lib/settings';

/**
 * The A4 PDF receipt.
 *
 * Built with the standard Helvetica family only, so no font files need to be
 * bundled or fetched at runtime (the Content-Security-Policy forbids remote
 * fonts anyway). Peso amounts are written as "PHP 1,234.00" rather than "₱"
 * because the built-in fonts have no peso glyph — see `peso()` below.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#000' },

  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  logo: { width: 56, height: 56, objectFit: 'contain', marginBottom: 6 },
  shopName: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', letterSpacing: 0.5 },
  shopLine: { fontSize: 9, textAlign: 'center', marginTop: 3 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  metaBlock: { maxWidth: '48%' },
  metaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  metaValue: { fontSize: 10, marginBottom: 3 },

  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 3,
    marginTop: 12,
    marginBottom: 6,
  },

  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  headRow: { flexDirection: 'row', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  cellName: { flex: 4 },
  cellQty: { flex: 1, textAlign: 'right' },
  cellPrice: { flex: 2, textAlign: 'right' },
  cellAmount: { flex: 2, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },

  totalsBlock: { marginTop: 14 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  subtotalLine: { borderTopWidth: 1, borderTopColor: '#000', paddingTop: 5, marginTop: 3 },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    marginVertical: 8,
  },
  grandLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 16, fontFamily: 'Helvetica-Bold' },

  notes: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#666', paddingTop: 6 },

  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 10,
    textAlign: 'center',
  },
  thanks: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  footerLine: { fontSize: 9, marginTop: 3 },
  notOfficial: { fontSize: 8, marginTop: 8, fontFamily: 'Helvetica-Oblique', color: '#444' },
});

/** Message keys the PDF needs, resolved by the caller so the PDF is translated. */
export interface ReceiptLabels {
  jobNumber: string;
  date: string;
  customer: string;
  vehicle: string;
  servicesDone: string;
  spareParts: string;
  item: string;
  qty: string;
  unitPrice: string;
  amount: string;
  labor: string;
  expenses: string;
  subtotal: string;
  discount: string;
  total: string;
  amountPaid: string;
  balance: string;
  paymentMethod: string;
  paymentMethodValue: string;
  status: string;
  statusValue: string;
  notes: string;
  thankYou: string;
  servedBy: string;
  tin: string;
  notOfficial: string;
}

/**
 * Helvetica has no ₱ glyph, so the currency is spelled out. Falling back to the
 * symbol here would render a blank box in every PDF reader.
 */
function peso(value: number, tag: string): string {
  return formatPeso(value, tag).replace(/^(₱|PHP\s?)/, 'PHP ');
}

export function ReceiptPdf({
  job,
  shop,
  labels,
  intlTag,
}: {
  job: SerializedJob;
  shop: ShopInfo;
  labels: ReceiptLabels;
  intlTag: string;
}) {
  const money = (v: number) => peso(v, intlTag);

  return (
    <Document
      title={`${job.jobNumber} — ${shop.name}`}
      author={shop.name}
      subject={labels.total}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* A PNG data URL, checked on upload (lib/logo.ts). */}
          {/* react-pdf's Image is not an HTML <img>; it has no alt attribute. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {shop.logo ? <Image src={shop.logo} style={styles.logo} /> : null}
          <Text style={styles.shopName}>{shop.name.toUpperCase()}</Text>
          <Text style={styles.shopLine}>{shop.address}</Text>
          <Text style={styles.shopLine}>{shop.phone}</Text>
          {shop.email ? <Text style={styles.shopLine}>{shop.email}</Text> : null}
          {shop.tin ? (
            <Text style={styles.shopLine}>
              {labels.tin}: {shop.tin}
            </Text>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{labels.jobNumber}</Text>
            <Text style={styles.metaValue}>{job.jobNumber}</Text>
            <Text style={styles.metaLabel}>{labels.date}</Text>
            <Text style={styles.metaValue}>{formatDate(job.date, intlTag)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{labels.customer}</Text>
            <Text style={styles.metaValue}>{job.customer.fullName}</Text>
            {job.customer.phone ? (
              <Text style={styles.metaValue}>{job.customer.phone}</Text>
            ) : null}
            <Text style={styles.metaLabel}>{labels.vehicle}</Text>
            <Text style={styles.metaValue}>{describeVehicle(job.vehicle)}</Text>
          </View>
        </View>

        {job.services.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>{labels.servicesDone}</Text>
            {job.services.map((service) => (
              <View key={service.id} style={styles.row}>
                <Text style={styles.cellName}>{service.serviceName}</Text>
                <Text style={styles.cellAmount}>{money(service.price)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {job.parts.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>{labels.spareParts}</Text>
            <View style={styles.headRow}>
              <Text style={[styles.cellName, styles.bold]}>{labels.item}</Text>
              <Text style={[styles.cellQty, styles.bold]}>{labels.qty}</Text>
              <Text style={[styles.cellPrice, styles.bold]}>{labels.unitPrice}</Text>
              <Text style={[styles.cellAmount, styles.bold]}>{labels.amount}</Text>
            </View>
            {job.parts.map((part) => (
              <View key={part.id} style={styles.row}>
                <Text style={styles.cellName}>{part.partName}</Text>
                <Text style={styles.cellQty}>{part.quantity}</Text>
                <Text style={styles.cellPrice}>{money(part.unitPrice)}</Text>
                <Text style={styles.cellAmount}>{money(part.lineTotal)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.totalsBlock}>
          <View style={styles.totalLine}>
            <Text>{labels.labor}</Text>
            <Text>{money(job.laborCharge)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text>{labels.expenses}</Text>
            <Text>{money(job.expenses)}</Text>
          </View>

          <View style={[styles.totalLine, styles.subtotalLine]}>
            <Text style={styles.bold}>{labels.subtotal}</Text>
            <Text style={styles.bold}>{money(job.subtotal)}</Text>
          </View>

          {job.discount > 0 ? (
            <View style={styles.totalLine}>
              <Text>{labels.discount}</Text>
              <Text>- {money(job.discount)}</Text>
            </View>
          ) : null}

          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>{labels.total.toUpperCase()}</Text>
            <Text style={styles.grandValue}>{money(job.total)}</Text>
          </View>

          <View style={styles.totalLine}>
            <Text style={styles.bold}>{labels.amountPaid}</Text>
            <Text style={styles.bold}>{money(job.amountPaid)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.bold}>{labels.balance}</Text>
            <Text style={styles.bold}>{money(job.balance)}</Text>
          </View>
          {job.paymentMethod ? (
            <View style={styles.totalLine}>
              <Text>{labels.paymentMethod}</Text>
              <Text>{labels.paymentMethodValue}</Text>
            </View>
          ) : null}
          <View style={styles.totalLine}>
            <Text>{labels.status}</Text>
            <Text style={styles.bold}>{labels.statusValue}</Text>
          </View>
        </View>

        {job.notes ? (
          <View style={styles.notes}>
            <Text style={styles.bold}>{labels.notes}</Text>
            <Text>{job.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.thanks}>{shop.footer || labels.thankYou}</Text>
          {job.mechanic || job.createdBy ? (
            <Text style={styles.footerLine}>
              {labels.servedBy}: {job.mechanic?.name ?? job.createdBy?.name}
            </Text>
          ) : null}
          <Text style={styles.notOfficial}>{labels.notOfficial}</Text>
        </View>
      </Page>
    </Document>
  );
}
