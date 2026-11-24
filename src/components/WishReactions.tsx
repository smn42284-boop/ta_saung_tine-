import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { lanternService, type Lantern } from "@/lib/lanterns";
import type { ReactionType } from "../../shared/wishes";

const OPTIONS: {
  type: ReactionType;
  emoji: string;
  label: string;
}[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "thankful", emoji: "🙏", label: "Thankful" },
];

interface WishReactionsProps {
  wish: Lantern;
}

export function WishReactions({ wish }: WishReactionsProps) {
  const [counts, setCounts] = useState(wish.reactions);
  const [selected, setSelected] = useState(wish.myReaction);
  const [isOpen, setIsOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalDemo, setIsLocalDemo] = useState(false);
  const [celebrating, setCelebrating] = useState<ReactionType | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCounts(wish.reactions);
    setSelected(wish.myReaction);
  }, [wish.reactions, wish.myReaction]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(null), 800);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const picker = pickerRef.current;
    if (!trigger || !picker) return;

    const positionPicker = () => {
      const anchor = trigger.getBoundingClientRect();
      const pickerBounds = picker.getBoundingClientRect();
      const edge = 8;
      const gap = 8;
      const above = anchor.top - pickerBounds.height - gap;
      const below = anchor.bottom + gap;
      const maxTop = Math.max(edge, window.innerHeight - pickerBounds.height - edge);
      const top =
        above >= edge
          ? above
          : below + pickerBounds.height <= window.innerHeight - edge
            ? below
            : Math.min(Math.max(edge, above), maxTop);
      const left = Math.min(
        Math.max(edge, anchor.left + (anchor.width - pickerBounds.width) / 2),
        Math.max(edge, window.innerWidth - pickerBounds.width - edge),
      );
      setPickerPosition((current) =>
        current?.top === top && current.left === left ? current : { top, left },
      );
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !trigger.contains(target) && !picker.contains(target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        trigger.focus();
      }
    };

    positionPicker();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionPicker);
    window.addEventListener("scroll", positionPicker, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionPicker);
      window.removeEventListener("scroll", positionPicker, true);
    };
  }, [isOpen]);

  async function chooseReaction(reaction: ReactionType) {
    if (isSaving) return;
    const previousCounts = counts;
    const previousReaction = selected;
    const nextReaction = selected === reaction ? null : reaction;
    const nextCounts = { ...counts };
    if (previousReaction)
      nextCounts[previousReaction] = Math.max(0, nextCounts[previousReaction] - 1);
    if (nextReaction) nextCounts[nextReaction] += 1;
    setCounts(nextCounts);
    setSelected(nextReaction);
    setIsOpen(false);
    setPickerPosition(null);
    triggerRef.current?.focus();
    setError(null);
    setIsSaving(true);
    setCelebrating(nextReaction === "love" || nextReaction === "thankful" ? nextReaction : null);
    try {
      const saved = await lanternService.react(wish, nextReaction);
      setCounts(saved.reactions);
      setSelected(saved.myReaction);
      setIsLocalDemo(saved.isLocalDemo);
    } catch (reason) {
      setCounts(previousCounts);
      setSelected(previousReaction);
      setError(reason instanceof Error ? reason.message : "Your reaction could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasCounts = OPTIONS.some(({ type }) => counts[type] > 0);
  const selectedLabel = OPTIONS.find((option) => option.type === selected)?.label;

  return (
    <div className={`wish-reactions${isOpen ? " wish-reactions-open" : ""}`}>
      {hasCounts && (
        <div className="wish-reaction-summary" aria-label="Wish reactions">
          {OPTIONS.map(
            ({ type, emoji, label }) =>
              counts[type] > 0 && (
                <span
                  className={`wish-reaction-count${selected === type ? " wish-reaction-active" : ""}`}
                  key={type}
                  aria-label={`${counts[type]} ${label}${counts[type] === 1 ? "" : " reactions"}`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span>{counts[type].toLocaleString()}</span>
                </span>
              ),
          )}
        </div>
      )}
      <button
        ref={triggerRef}
        className={`wish-reaction-trigger${selected ? " wish-reaction-active" : ""}`}
        type="button"
        aria-label={
          selectedLabel ? `Change or remove your ${selectedLabel} reaction` : "React to wish"
        }
        aria-expanded={isOpen}
        aria-controls={isOpen ? `wish-reaction-picker-${wish.id}` : undefined}
        disabled={isSaving}
        onClick={() => {
          setPickerPosition(null);
          setIsOpen((open) => !open);
        }}
      >
        <span aria-hidden="true">
          {OPTIONS.find((option) => option.type === selected)?.emoji ?? "✨"}
        </span>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            id={`wish-reaction-picker-${wish.id}`}
            className="wish-reaction-picker"
            role="group"
            aria-label="Choose a reaction"
            style={
              {
                top: pickerPosition?.top ?? 0,
                left: pickerPosition?.left ?? 0,
                visibility: pickerPosition ? "visible" : "hidden",
              } as CSSProperties
            }
          >
            {OPTIONS.map(({ type, emoji, label }) => (
              <button
                className={`wish-reaction-option${selected === type ? " wish-reaction-active" : ""}`}
                type="button"
                key={type}
                aria-label={
                  selected === type ? `${label}, selected. Select again to remove` : label
                }
                aria-pressed={selected === type}
                disabled={isSaving}
                onClick={() => void chooseReaction(type)}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      {celebrating && (
        <span
          className={`wish-reaction-sparkle wish-reaction-sparkle-${celebrating}`}
          aria-hidden="true"
        >
          {celebrating === "love" ? "♥" : "✨"}
        </span>
      )}
      {isSaving && (
        <span className="sr-only" role="status">
          Saving reaction
        </span>
      )}
      {error && (
        <span className="wish-reaction-error" role="status">
          {error}
        </span>
      )}
      {isLocalDemo && (
        <span className="wish-reaction-local-note" role="status">
          Saved in this browser demo only; not shared across devices.
        </span>
      )}
    </div>
  );
}
