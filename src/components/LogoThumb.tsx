import { cn } from "@/lib/utils";
import { tileBackground, useImageLightness, useLogoBgMode } from "../logoBackdrop";

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
  const mode = useLogoBgMode();
  // Only measure the logo when it decides the tile: the card mode, with no
  // card background to go by.
  const lightness = useImageLightness(src, mode === "card" && backdrop === null);
  const css = tileBackground(mode, backdrop, lightness ?? null);
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
