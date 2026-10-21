import Image from "next/image";

/**
 * `inverse` is a separate asset, not a CSS filter.
 *
 * The lockup is black ink plus an orange ball. `filter: invert(1)` would flip
 * the black to white but take the orange to blue, and `brightness(0)
 * invert(1)` flattens the whole mark to solid white and loses the ball. The
 * inverse file flips only the achromatic pixels, so the orange survives.
 */
type BrandVariant = "default" | "inverse";

const SRC: Record<BrandVariant, string> = {
  default: "/opengymlogo.png",
  inverse: "/opengymlogo-inverse.png",
};

type BrandMarkProps = {
  /** Height utility for the mark. Defaults to the header's 80px lockup. */
  className?: string;
  /**
   * The header's mark is above the fold and worth preloading; the footer's is
   * not, and marking both `priority` would ask the browser to rush an image
   * nobody sees until they scroll.
   */
  priority?: boolean;
  /** `inverse` for dark backgrounds. */
  variant?: BrandVariant;
};

export function BrandMark({
  className = "h-20",
  priority = true,
  variant = "default",
}: BrandMarkProps) {
  return (
    <span className="inline-flex shrink-0 items-center">
      <Image
        src={SRC[variant]}
        alt="OpenGym"
        width={148}
        height={113}
        priority={priority}
        className={`w-auto object-contain ${className}`}
      />
    </span>
  );
}
