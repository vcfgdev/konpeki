import { useEffect, useRef, useState } from "react";
import type { Draft } from "../lib/model.ts";
import { presentationAction } from "../lib/presentation.ts";
import { Canvas } from "./Canvas.tsx";

const noop = () => {};

export function Presentation({
  draft,
  initialSlideId,
  onExit,
}: {
  draft: Draft;
  initialSlideId: string;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(0, draft.slides.findIndex((slide) => slide.id === initialSlideId)),
  );
  const overlay = useRef<HTMLDivElement>(null);
  const slide = draft.slides[index];

  useEffect(() => {
    overlay.current?.focus();
  }, []);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const interactiveTarget =
        event.target instanceof Element &&
        Boolean(event.target.closest("button,a,input,textarea,select,[contenteditable=true]"));
      const action = presentationAction(
        event.key,
        index,
        draft.slides.length,
        interactiveTarget,
      );
      if (action === undefined) return;
      event.preventDefault();
      if (action === "exit") onExit();
      else setIndex(action);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [draft.slides.length, index, onExit]);

  return (
    <div
      ref={overlay}
      className="presentation"
      role="dialog"
      aria-modal="true"
      aria-label="Presentation mode"
      tabIndex={-1}
    >
      <Canvas
        key={slide.id}
        mode="present"
        draft={draft}
        activeSlideId={slide.id}
        onSelect={noop}
        onSlideName={noop}
        onComponent={noop}
        onEditEnd={noop}
        onAdd={noop}
        onNotice={noop}
      />
      <nav className="presentation-controls" aria-label="Presentation controls">
        <button
          type="button"
          disabled={index === 0}
          aria-label="Previous page"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          ←
        </button>
        <span aria-live="polite">
          {index + 1} / {draft.slides.length}
        </span>
        <button
          type="button"
          disabled={index === draft.slides.length - 1}
          aria-label="Next page"
          onClick={() =>
            setIndex((value) => Math.min(draft.slides.length - 1, value + 1))
          }
        >
          →
        </button>
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void overlay.current?.requestFullscreen();
          }}
        >
          Full screen
        </button>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </nav>
    </div>
  );
}
