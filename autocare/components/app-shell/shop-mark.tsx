/**
 * The shop's name as a wordmark. The first hyphen ("HI-OCTEN") is picked out
 * in orange — the one flourish the brand allows itself. A name without a
 * hyphen is shown plainly; the shop name is editable in Settings.
 */
export function ShopMark({
  name,
  accentClassName = 'text-primary',
}: {
  name: string;
  /** On the dark brand panel the hyphen uses the meter's lighter accent. */
  accentClassName?: string;
}) {
  const i = name.indexOf('-');
  if (i <= 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, i)}
      <span className={accentClassName}>-</span>
      {name.slice(i + 1)}
    </>
  );
}
