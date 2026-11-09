/**
 * The shop's name as a wordmark. The first hyphen ("HI-OCTEN") is picked out
 * in orange — the one flourish the brand allows itself. A name without a
 * hyphen is shown plainly; the shop name is editable in Settings.
 */
export function ShopMark({ name }: { name: string }) {
  const i = name.indexOf('-');
  if (i <= 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, i)}
      <span className="text-primary">-</span>
      {name.slice(i + 1)}
    </>
  );
}
