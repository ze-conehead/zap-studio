import { resolveBackground } from "../background";
import { CANVAS } from "../card";
import { FONTS } from "../fonts";
import { isImage, isText } from "../factory";
import { useStore } from "../store";
import type { CardBackground, ImageLayer, Layer, TextLayer } from "../types";

export function Inspector() {
  const { state, selected, dispatch } = useStore();

  const patch = (p: Partial<Layer>, history = true) =>
    selected && dispatch({ type: "PATCH_LAYER", id: selected.id, patch: p, history });

  if (!selected) {
    if (state.project.isTemplate) {
      return (
        <section className="panel">
          <h2>Konsolen-Vorlage</h2>
          <p className="hint">
            Diese Ebenen erscheinen automatisch auf <strong>allen</strong>{" "}
            Spiel-Karten von {state.project.consoleName}. Kein eigener
            Kartenhintergrund – füge Bilder, Logos oder Texte hinzu.
          </p>
        </section>
      );
    }
    return (
      <section className="panel">
        <h2>Kartenhintergrund</h2>
        <BackgroundControls />
        <p className="hint">Wähle eine Ebene aus, um sie zu bearbeiten.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Eigenschaften</h2>

      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={selected.name}
          onChange={(e) => patch({ name: e.target.value }, false)}
          onBlur={(e) => patch({ name: e.target.value })}
        />
      </label>

      <div className="grid2">
        <NumberField label="X" value={round(selected.x)} onChange={(v) => patch({ x: v })} />
        <NumberField label="Y" value={round(selected.y)} onChange={(v) => patch({ y: v })} />
        <NumberField
          label="Drehung °"
          value={round(selected.rotation)}
          onChange={(v) => patch({ rotation: v })}
        />
        <NumberField
          label="Größe %"
          value={round(selected.scaleX * 100)}
          step={1}
          onChange={(v) => patch({ scaleX: v / 100, scaleY: v / 100 })}
        />
      </div>

      <label className="field">
        <span>Deckkraft {Math.round(selected.opacity * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={selected.opacity}
          onChange={(e) => patch({ opacity: Number(e.target.value) }, false)}
          onMouseUp={(e) => patch({ opacity: Number((e.target as HTMLInputElement).value) })}
        />
      </label>

      <div className="row-btns">
        <button onClick={() => patch({ x: CANVAS.w / 2 })}>Horizontal zentrieren</button>
        <button onClick={() => patch({ y: CANVAS.h / 2 })}>Vertikal zentrieren</button>
      </div>

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
    </section>
  );
}

function BackgroundControls() {
  const { state, dispatch } = useStore();
  const bg = resolveBackground(state.project);
  const set = (patch: Partial<CardBackground>, history = true) =>
    dispatch({ type: "SET_BACKGROUND", patch, history });

  return (
    <>
      <div className="row-btns">
        <button
          className={bg.kind === "solid" ? "toggle on" : "toggle"}
          onClick={() => set({ kind: "solid" })}
        >
          Farbe
        </button>
        <button
          className={bg.kind === "gradient" ? "toggle on" : "toggle"}
          onClick={() => set({ kind: "gradient" })}
        >
          Verlauf
        </button>
      </div>

      {bg.kind === "solid" ? (
        <label className="field">
          <span>Farbe</span>
          <input type="color" value={bg.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
      ) : (
        <>
          <div className="grid2">
            <label className="field">
              <span>Von</span>
              <input
                type="color"
                value={bg.color}
                onChange={(e) => set({ color: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Nach</span>
              <input
                type="color"
                value={bg.color2}
                onChange={(e) => set({ color2: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Richtung {Math.round(bg.angle)}°</span>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={bg.angle}
              onChange={(e) => set({ angle: Number(e.target.value) }, false)}
              onPointerUp={(e) => set({ angle: Number((e.target as HTMLInputElement).value) })}
            />
          </label>
          <div className="row-btns">
            {(
              [
                ["↓", 90],
                ["→", 0],
                ["↘", 45],
                ["↗", 315],
              ] as const
            ).map(([label, a]) => (
              <button
                key={a}
                className={bg.angle === a ? "toggle on" : "toggle"}
                onClick={() => set({ angle: a })}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="field">
        <span>Körnung / Noise {Math.round(bg.noise * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={bg.noise}
          onChange={(e) => set({ noise: Number(e.target.value) }, false)}
          onPointerUp={(e) => set({ noise: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
    </>
  );
}

function ImageProps({
  layer,
  patch,
}: {
  layer: ImageLayer;
  patch: (p: Partial<Layer>, history?: boolean) => void;
}) {
  return (
    <>
      <div className="grid2">
        <NumberField
          label="Breite px"
          value={round(layer.width)}
          onChange={(v) => {
            const ratio = layer.height / layer.width;
            patch({ width: v, height: v * ratio });
          }}
        />
        <NumberField
          label="Ecken-Radius"
          value={round(layer.cornerRadius)}
          onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
        />
      </div>
      <p className="hint">Original: {layer.naturalWidth}×{layer.naturalHeight} px</p>
    </>
  );
}

function TextProps({
  layer,
  patch,
}: {
  layer: TextLayer;
  patch: (p: Partial<Layer>, history?: boolean) => void;
}) {
  return (
    <>
      <label className="field">
        <span>Text</span>
        <textarea
          rows={2}
          value={layer.text}
          onChange={(e) => patch({ text: e.target.value }, false)}
          onBlur={(e) => patch({ text: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Schriftart</span>
        <select
          value={layer.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          style={{ fontFamily: layer.fontFamily }}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid2">
        <NumberField
          label="Größe px"
          value={round(layer.fontSize)}
          onChange={(v) => patch({ fontSize: Math.max(4, v) })}
        />
        <NumberField
          label="Box-Breite"
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(20, v) })}
        />
        <NumberField
          label="Zeilenhöhe"
          step={0.05}
          value={round(layer.lineHeight, 2)}
          onChange={(v) => patch({ lineHeight: v })}
        />
        <NumberField
          label="Laufweite"
          value={round(layer.letterSpacing)}
          onChange={(v) => patch({ letterSpacing: v })}
        />
      </div>

      <div className="row-btns">
        <button className={layer.bold ? "toggle on" : "toggle"} onClick={() => patch({ bold: !layer.bold })}>
          <b>B</b>
        </button>
        <button
          className={layer.italic ? "toggle on" : "toggle"}
          onClick={() => patch({ italic: !layer.italic })}
        >
          <i>I</i>
        </button>
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            className={layer.align === a ? "toggle on" : "toggle"}
            onClick={() => patch({ align: a })}
          >
            {a === "left" ? "⟵" : a === "center" ? "↔" : "⟶"}
          </button>
        ))}
      </div>

      <div className="grid2">
        <label className="field">
          <span>Textfarbe</span>
          <input type="color" value={layer.fill} onChange={(e) => patch({ fill: e.target.value })} />
        </label>
        <label className="field">
          <span>Konturfarbe</span>
          <input
            type="color"
            value={layer.stroke}
            onChange={(e) => patch({ stroke: e.target.value })}
          />
        </label>
      </div>
      <NumberField
        label="Konturstärke"
        value={round(layer.strokeWidth)}
        onChange={(v) => patch({ strokeWidth: Math.max(0, v) })}
      />
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
