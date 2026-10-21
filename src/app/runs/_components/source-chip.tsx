import Image from "next/image";
import { RunSourceType } from "@/generated/prisma/enums";

/**
 * The square mark on a run card saying where the run came from.
 *
 * It replaces the old text pill, and the old colour split: imported runs used
 * to be sky-blue and user runs orange, which meant carrying a second accent
 * through the whole palette. Every card is now styled identically and the
 * mark alone carries the difference, which scans far faster down a long list.
 *
 * The chip is white on purpose. The City of Toronto logo is supplied with an
 * opaque white background, and it is a municipal trademark -- altering it to
 * punch out the background would be both extra machinery and the wrong thing
 * to do to someone else's mark. A white tile with an ink border turns that
 * background into deliberate clear space.
 */
const CHIP_SRC: Partial<Record<RunSourceType, string>> = {
  [RunSourceType.CITY]: "/CityOfTorontoLogo.webp",
};

const FALLBACK_SRC = "/opengym-ball-chip.png";

export function SourceChip({
  sourceType,
  label,
}: {
  sourceType: RunSourceType;
  label: string;
}) {
  return (
    <span
      title={label}
      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border-2 border-foreground bg-white"
    >
      <Image
        src={CHIP_SRC[sourceType] ?? FALLBACK_SRC}
        alt={label}
        width={64}
        height={64}
        className="h-10 w-10 object-contain"
      />
    </span>
  );
}
