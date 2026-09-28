import { useState, type ReactNode } from "react";

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
