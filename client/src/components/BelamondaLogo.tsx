import belamondoLogo from "../assets/belamondo-logo.png";

export function BelamondaLogo({
  size = 48,
  className = "",
}: {
  /** Logo height in pixels (width scales automatically). */
  size?: number;
  /** @deprecated Logo image includes brand text; kept for compatibility. */
  showText?: boolean;
  className?: string;
}) {
  return (
    <img
      src={belamondoLogo}
      alt="Belamonda"
      height={size}
      className={`w-auto max-w-full object-contain ${className}`}
      style={{ height: size }}
      draggable={false}
    />
  );
}

export function BelamondaIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <BelamondaLogo size={size} className={className} />;
}
