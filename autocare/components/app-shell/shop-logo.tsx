import { cn } from '@/lib/utils';
import { monogram } from '@/lib/branding';

/**
 * The shop's logo, or — until one is uploaded — a monogram of its initials in
 * the shop's accent colour. Every install looks like its own shop from the
 * first day, without anyone needing a designer.
 *
 * Decorative: the shop's name always sits beside it as text, so the image
 * carries no alt text of its own.
 */
export function ShopLogo({
  name,
  logo,
  className,
}: {
  name: string;
  logo: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      // A data: URL resized in the browser; next/image has nothing to optimise.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        aria-hidden
        className={cn('size-12 shrink-0 rounded-xl object-contain', className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-12 shrink-0 select-none items-center justify-center rounded-xl bg-primary',
        'font-display text-lg font-bold tracking-wide text-primary-foreground',
        className,
      )}
    >
      {monogram(name)}
    </span>
  );
}
