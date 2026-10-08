import { cn } from "@/lib/utils";
import { tileForLightness, useImageLightness } from "../logoBackdrop";

// A logo on its preview tile: the card's own background when there is one
// (`backdrop`, see src/logoBackdrop.ts), else a light or dark tile picked
// from the logo itself, else the ordinary checkerboard.
export function LogoThumb({
  src,
  alt = "",
  backdrop,
  className,
  imgClassName,
}: {
  src: string | undefined;
  alt?: string;
  backdrop: string | null | undefined; // undefined = still loading
  className?: string;
  imgClassName?: string;
}) {
  // Only measure the logo when there's no card background to show it on.
  const lightness = useImageLightness(src, backdrop === null);
  const css = backdrop ?? tileForLightness(lightness ?? null);
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden rounded", !css && "canvas-checker", className)}
      style={css ? { background: css } : undefined}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          className={cn("max-h-full max-w-full object-contain", imgClassName)}
        />
      )}
    </div>
  );
}
