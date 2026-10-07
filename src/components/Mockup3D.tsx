// The sticker on the real thing: a box drawn with CSS 3D — a case with its
// wrap folded round it (front, spine, back), or a cartridge / cassette /
// disk shell with the label stuck on at its real position. Drag to turn,
// wheel to zoom. Sizes are in mm, scaled so the object fills the stage.

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { clampPan, PREVIEW_MAX_ZOOM, PREVIEW_MIN_ZOOM } from "../panLimit";

export interface Mockup3DHandle {
  reset: () => void;
  zoomBy: (f: number) => void;
  spin: (deg: number) => void;
}

interface Label {
  image: string | null;
  xMM: number;
  yMM: number;
  wMM: number;
  hMM: number;
  overlay?: ReactNode; // drawn over the label (holes / edges)
}

export function Mockup3D({
  ref,
  wMM,
  hMM,
  dMM,
  color,
  front,
  back,
  left,
  label,
  glossy = false,
  placeholder,
}: {
  ref?: Ref<Mockup3DHandle>;
  wMM: number;
  hMM: number;
  dMM: number;
  color: string;
  front?: string | null; // full-face pictures (a case wrap's panels)
  back?: string | null;
  left?: string | null;
  label?: Label; // a sticker on the front of a shell
  glossy?: boolean; // clear plastic sleeve over the wrap
  placeholder?: ReactNode;
}) {
  // Turned so the left side shows — the spine of a case.
  const START = { x: -10, y: 40 };
  const [rot, setRot] = useState(START);
  const [zoom, setZoom] = useState(1);
  // Panning: the whole object moves on screen (right / middle button or Shift + drag).
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; rx: number; ry: number } | null>(null);
  const panDrag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [unit, setUnit] = useState(4);

  // px per mm: the larger side gets ~60 % of the viewport height.
  useEffect(() => {
    const fit = () => setUnit(Math.min(window.innerHeight * 0.58, 560) / Math.max(hMM, wMM * 0.85));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [wMM, hMM]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setRot(START);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    zoomBy: (f) => setZoom((z) => Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, z * f))),
    spin: (deg) => setRot((r) => ({ ...r, y: r.y + deg })),
  }));

  const W = wMM * unit;
  const H = hMM * unit;
  const D = Math.max(1, dMM * unit);

  const face = (
    w: number,
    h: number,
    transform: string,
    shade: number, // -1 (dark) … 1 (light)
    content?: ReactNode,
  ) => (
    <div
      className="mockup3d-face"
      style={{
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        transform,
        background: color,
      }}
    >
      {content}
      {glossy && <div className="mockup3d-gloss" />}
      <div
        className="mockup3d-shade"
        style={{
          background: shade < 0 ? `rgba(0,0,0,${-shade})` : `rgba(255,255,255,${shade})`,
        }}
      />
    </div>
  );

  const pic = (src: string | null | undefined) =>
    src ? <img src={src} alt="" draggable={false} className="mockup3d-img" /> : null;

  return (
    <div
      className="mockup3d-stage"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.button === 1 && e.preventDefault() /* no middle-click autoscroll */}
      onPointerDown={(e) => {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // pointer already released — carry on, the move handler still works
        }
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
          panDrag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
          return;
        }
        drag.current = { px: e.clientX, py: e.clientY, rx: rot.x, ry: rot.y };
      }}
      onPointerMove={(e) => {
        const pd = panDrag.current;
        if (pd) {
          // The object's reach on screen: its longest side, zoomed.
          const reach = Math.max(W, H) * zoom;
          setPan({
            x: clampPan(pd.ox + e.clientX - pd.px, window.innerWidth, reach),
            y: clampPan(pd.oy + e.clientY - pd.py, window.innerHeight, reach),
          });
          return;
        }
        const d = drag.current;
        if (!d) return;
        setRot({
          x: Math.max(-80, Math.min(80, d.rx - (e.clientY - d.py) * 0.35)),
          y: d.ry + (e.clientX - d.px) * 0.35,
        });
      }}
      onPointerUp={() => {
        drag.current = null;
        panDrag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
        panDrag.current = null;
      }}
      onWheel={(e) =>
        setZoom((z) => Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, z * (1 - e.deltaY * 0.0014))))
      }
    >
      <div
        className="mockup3d-box"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        }}
      >
        {face(
          W,
          H,
          `translateZ(${D / 2}px)`,
          0,
          label ? (
            <div
              className="mockup3d-label"
              style={{
                left: label.xMM * unit,
                top: label.yMM * unit,
                width: label.wMM * unit,
                height: label.hMM * unit,
              }}
            >
              {label.image ? (
                <img src={label.image} alt="" draggable={false} className="mockup3d-img" />
              ) : (
                <div className="preview3d-placeholder">{placeholder}</div>
              )}
              {label.overlay}
            </div>
          ) : front ? (
            pic(front)
          ) : (
            <div className="preview3d-placeholder">{placeholder}</div>
          ),
        )}
        {face(W, H, `rotateY(180deg) translateZ(${D / 2}px)`, -0.15, pic(back))}
        {face(D, H, `rotateY(-90deg) translateZ(${W / 2}px)`, -0.22, pic(left))}
        {face(D, H, `rotateY(90deg) translateZ(${W / 2}px)`, -0.3)}
        {face(W, D, `rotateX(90deg) translateZ(${H / 2}px)`, 0.12)}
        {face(W, D, `rotateX(-90deg) translateZ(${H / 2}px)`, -0.4)}
      </div>
    </div>
  );
}
