import { z } from 'zod';
import { PASSWORD_RULES } from './password';
import { localeCodes } from '@/i18n/locales';
import { addMonths, dateToYmd, isYmd } from './reminders';

/**
 * Every mutation in AutoCare validates its input with one of these schemas —
 * on the client (for instant, friendly feedback) and again on the server (which
 * never trusts the client). Error messages are message-catalog keys so the UI
 * can show them in the user's own language.
 */

/** A money field arriving from a form: "", "0", "1,250.50", 1250.5 — all fine. */
export const money = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (typeof v === 'number') return v;
    const cleaned = v.replace(/[₱,\s]/g, '').trim();
    if (cleaned === '') return 0;
    return Number(cleaned);
  })
  .pipe(
    z
      .number({ invalid_type_error: 'errors.invalidNumber' })
      .finite('errors.invalidNumber')
      .min(0, 'errors.negativeNumber')
      .max(99_999_999, 'errors.invalidNumber'),
  );

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

/**
 * An optional whole number from a form — an odometer reading, a number of
 * months: "", null, "45,210", "45 210 km", 45210. Blank means none (null).
 */
const optionalWhole = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'number') return v;
      const cleaned = v.replace(/[,\s]/g, '').replace(/km$/i, '');
      return cleaned === '' ? null : Number(cleaned);
    })
    .pipe(
      z
        .number({ invalid_type_error: 'errors.invalidNumber' })
        .int('errors.invalidNumber')
        .min(min, 'errors.invalidNumber')
        .max(max, 'errors.invalidNumber')
        .nullable(),
    );

/** An optional calendar date, "YYYY-MM-DD". Blank means none (null). */
const optionalYmd = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? v.trim() : null) || null)
  .refine((v) => v === null || isYmd(v), 'errors.invalidDate');

/** Odometer readings above this are typos, not cars. */
export const MAX_ODOMETER_KM = 2_000_000;

// ---------------------------------------------------------------- auth

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'errors.requiredField').max(64),
  password: z.string().min(1, 'errors.requiredField').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.minLength, 'users.ruleLength')
  .max(200)
  .regex(PASSWORD_RULES.upper, 'users.ruleUpper')
  .regex(PASSWORD_RULES.lower, 'users.ruleLower')
  .regex(PASSWORD_RULES.number, 'users.ruleNumber')
  .regex(PASSWORD_RULES.symbol, 'users.ruleSymbol');

// ---------------------------------------------------------------- customer

export const customerSchema = z.object({
  fullName: z.string().trim().min(1, 'errors.nameRequired').max(120),
  phone: optionalText(40),
  address: optionalText(300),
  notes: optionalText(1000),
});
export type CustomerInput = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------- vehicle

export const vehicleSchema = z.object({
  customerId: z.string().trim().min(1, 'errors.requiredField'),
  plateNumber: z
    .string()
    .trim()
    .min(1, 'errors.plateRequired')
    .max(24)
    .transform((v) => v.toUpperCase()),
  make: optionalText(60),
  model: optionalText(60),
  year: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.floor(n) : undefined;
    })
    .refine((v) => v === undefined || (v >= 1900 && v <= 2100), 'errors.invalidNumber'),
  color: optionalText(40),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

// ---------------------------------------------------------------- service catalog

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'errors.serviceNameRequired').max(80),
  defaultPrice: money,
  isActive: z.coerce.boolean().default(true),
  /** How often this service should be repeated, for the Babalikan reminders. */
  remindAfterMonths: optionalWhole(1, 60),
  remindAfterKm: optionalWhole(100, 200_000),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

// ---------------------------------------------------------------- job

export const jobPartSchema = z.object({
  partName: z.string().trim().min(1, 'errors.partNameRequired').max(120),
  quantity: z.coerce
    .number({ invalid_type_error: 'errors.invalidNumber' })
    .int('errors.invalidNumber')
    .min(1, 'errors.quantityMin')
    .max(10_000),
  unitPrice: money,
});

export const jobServiceSchema = z.object({
  serviceId: z.string().trim().optional().nullable(),
  serviceName: z.string().trim().min(1, 'errors.serviceNameRequired').max(120),
  price: money,
});

export const jobSchema = z
  .object({
    customerId: z.string().trim().min(1, 'wizard.missingCustomer'),
    vehicleId: z.string().trim().min(1, 'wizard.missingVehicle'),
    mechanicId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v === '' || v === 'none' ? null : (v ?? null))),
    date: z
      .union([z.string(), z.date()])
      .optional()
      .transform((v) => {
        if (!v) return new Date();
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? new Date() : d;
      }),
    laborCharge: money.default(0),
    expenses: money.default(0),
    discount: money.default(0),
    amountPaid: money.default(0),
    paymentMethod: z
      .enum(['CASH', 'GCASH', 'OTHER'])
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    notes: optionalText(2000),
    parts: z.array(jobPartSchema).max(100).default([]),
    services: z.array(jobServiceSchema).max(100).default([]),
    odometerKm: optionalWhole(0, MAX_ODOMETER_KM),
    nextVisitOn: optionalYmd,
    nextVisitKm: optionalWhole(1, MAX_ODOMETER_KM),
  })
  // NOTE: subtotal / total / balance / status are deliberately absent. They are
  // never accepted from the client — the server always recomputes them with
  // lib/calc.ts from the fields above.
  .superRefine((data, ctx) => {
    // The next visit has to come after the job, and within five years of it.
    if (data.nextVisitOn) {
      const jobDay = dateToYmd(data.date);
      if (data.nextVisitOn <= jobDay || data.nextVisitOn > addMonths(jobDay, 60)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nextVisitOn'],
          message: 'errors.invalidDate',
        });
      }
    }
    // "Come back at 50,000 km" makes no sense for a car already past it.
    if (
      data.nextVisitKm !== null &&
      data.odometerKm !== null &&
      data.nextVisitKm <= data.odometerKm
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextVisitKm'],
        message: 'errors.nextVisitKmTooLow',
      });
    }

    const gross =
      data.laborCharge +
      data.expenses +
      data.parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0) +
      data.services.reduce((s, v) => s + v.price, 0);

    if (data.discount > gross + 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount'],
        message: 'errors.discountTooHigh',
      });
    }
  });
export type JobInput = z.infer<typeof jobSchema>;

// ---------------------------------------------------------------- users

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'errors.requiredField').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'errors.requiredField')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'errors.requiredField')
    .transform((v) => v.toLowerCase()),
  password: passwordSchema,
  // v1 only ever creates STAFF from the UI, but ADMIN is accepted so the owner
  // can promote a trusted person without a code change.
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  userId: z.string().trim().min(1),
  password: passwordSchema,
});

export const userIdSchema = z.object({ userId: z.string().trim().min(1) });

/**
 * Changing your own password. The current one is required so that an unlocked
 * device cannot be used to take the account over.
 */
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'errors.requiredField').max(200),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------- settings

export const shopSettingsSchema = z.object({
  name: z.string().trim().min(1, 'errors.requiredField').max(120),
  address: z.string().trim().min(1, 'errors.requiredField').max(300),
  phone: z.string().trim().min(1, 'errors.requiredField').max(60),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, 'errors.requiredField'),
  footer: optionalText(300),
  /** Philippine TIN, e.g. 123-456-789-000. Optional; digits, dashes and spaces. */
  tin: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || /^[0-9][0-9 -]*$/.test(v), 'errors.invalidNumber'),
  // The accent colour and logo are saved by their own actions, so saving the
  // details here never resets them.
});
export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;

// ------------------------------------------------------------------- setup

/**
 * First-run setup of a fresh install: the shop's details and its owner's
 * account, in one form. See lib/setup.ts for when it is allowed at all.
 */
export const setupSchema = z.object({
  code: z.string().min(1, 'errors.requiredField').max(200),
  shopName: z.string().trim().min(1, 'errors.requiredField').max(120),
  address: z.string().trim().min(1, 'errors.requiredField').max(300),
  phone: z.string().trim().min(1, 'errors.requiredField').max(60),
  ownerName: z.string().trim().min(1, 'errors.requiredField').max(120),
  username: createUserSchema.shape.username,
  password: passwordSchema,
  starterServices: z.boolean().default(true),
});
export type SetupInput = z.infer<typeof setupSchema>;

export const localeSchema = z.object({
  locale: z.enum(localeCodes as [string, ...string[]]),
});

// ---------------------------------------------------------------- filters

export const jobFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  /**
   * A job status, or OWED for "anything not fully paid" (unpaid + part-paid),
   * which is what the home screen's "still owed" figure adds up. An unknown
   * value is ignored rather than failing the page.
   */
  status: z.enum(['PAID', 'UNPAID', 'PARTIAL', 'OWED']).optional().catch(undefined),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const dateRangeSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

/**
 * Flatten a ZodError into `{ fieldName: 'message.catalog.key' }` for forms.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
