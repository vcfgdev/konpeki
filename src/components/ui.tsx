import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Retain the last content while CSS transitions out; hidden notices are inert. */
export function FeedbackNotice({ kind, children, tone = "neutral", onDismiss, onPauseChange }: {
  kind: "toast" | "recovery";
  children: ReactNode;
  tone?: "neutral" | "error";
  onDismiss?: () => void;
  onPauseChange?: (paused: boolean) => void;
}) {
  const visible = Boolean(children);
  const [last, setLast] = useState({ children, tone });
  if (visible && (children !== last.children || tone !== last.tone)) setLast({ children, tone });
  return <div className={`feedback-notice ${kind}${visible ? " visible" : ""}${last.tone === "error" ? " error" : ""}`}
    inert={!visible} aria-hidden={!visible} role={kind === "recovery" && visible ? "alert" : undefined}
    onMouseEnter={() => onPauseChange?.(true)} onMouseLeave={() => onPauseChange?.(false)}
    onFocus={() => onPauseChange?.(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onPauseChange?.(false); }}>
    {kind === "toast" ? <span role={visible ? last.tone === "error" ? "alert" : "status" : undefined}
      aria-live={visible ? last.tone === "error" ? "assertive" : "polite" : "off"}>{last.children}</span> : last.children}
    {onDismiss && last.children && <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={onDismiss}>×</button>}
  </div>;
}

/** Keep incomplete input out of the document, without silently correcting it. */
export function NumberField({ label, name, value, min, max, step = 1, unit, onCommit, onEditEnd }: {
  label: string;
  name?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onCommit: (value: number) => void;
  onEditEnd: () => void;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => { setText(String(value)); setError(""); }, [value]);
  useLayoutEffect(() => {
    if (!error || !showError) return;
    function place() {
      const rect = input.current!.getBoundingClientRect();
      const panel = input.current!.closest(".right-panel")!.getBoundingClientRect();
      const beside = panel.left >= 276;
      setPosition({ top: Math.max(8, Math.min(beside ? rect.top : rect.bottom + 6, window.innerHeight - 80)), left: beside ? panel.left - 268 : Math.max(8, Math.min(rect.left, window.innerWidth - 268)) });
      if (rect.bottom < panel.top + 58 || rect.top > panel.bottom) setShowError(false);
    }
    function focus(event: FocusEvent) {
      if (event.target !== input.current) setShowError(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("focusin", focus);
    };
  }, [error, showError]);
  function commit() {
    const number = Number(text);
    if (!text.trim() || !Number.isFinite(number) || number < min || number > max) {
      setError(`${label} must be ${min}–${max}${unit ? ` ${unit}` : ""}. Escape restores the previous value.`);
      setShowError(true);
    } else {
      setError("");
      if (number !== value) onCommit(number);
    }
    onEditEnd();
  }
  return <Field label={label}>
    <span className={unit ? "parameter-input" : "number-input"}>
      <input ref={input} name={name} type="number" autoComplete="off" min={min} max={max} step={step}
        value={text} aria-invalid={error ? true : undefined} aria-describedby={error ? id : undefined}
        onChange={event => setText(event.target.value)} onFocus={() => setShowError(true)} onBlur={commit}
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && ["z", "y"].includes(event.key.toLowerCase()) && text !== String(value)) event.stopPropagation();
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation();
            setText(String(value)); setError(""); onEditEnd();
          }
        }} />
      {unit && <span className="parameter-unit" aria-hidden="true">{unit}</span>}
    </span>
    {error && createPortal(<span id={id} role="alert" className={showError ? "parameter-error" : "sr-only"} style={showError ? position : undefined}>{error}</span>, document.body)}
  </Field>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabels?: Partial<Record<string, string>>;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field label={label}>
      <select
        id={id}
        name={label}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? humanize(option)}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
