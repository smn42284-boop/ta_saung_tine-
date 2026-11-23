import { useEffect, useState } from "react";
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalDemo, setIsLocalDemo] = useState(false);
  const [celebrating, setCelebrating] = useState<ReactionType | null>(null);

  useEffect(() => {
    setCounts(wish.reactions);
    setSelected(wish.myReaction);
  }, [wish.reactions, wish.myReaction]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(null), 800);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

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

  const selectedOption = OPTIONS.find((option) => option.type === selected);

  return (
    <div className={`wish-reactions${isOpen ? " wish-reactions-open" : ""}`}>
      <div className="wish-reaction-summary" aria-label="Wish reactions">
        {OPTIONS.map(
          ({ type, emoji, label }) =>
            counts[type] > 0 && (
              <span
                className={`wish-reaction-count${selected === type ? " wish-reaction-active" : ""}`}
                key={type}
                aria-label={`${counts[type]} ${label}${counts[type] === 1 ? "" : " reactions"}`}
                title={label}
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{counts[type].toLocaleString()}</span>
              </span>
            ),
        )}
      </div>
      <button
        className={`wish-reaction-trigger${selected ? " wish-reaction-active" : ""}`}
        type="button"
        aria-label={
          selectedOption ? `Change reaction, currently ${selectedOption.label}` : "React to wish"
        }
        aria-expanded={isOpen}
        disabled={isSaving}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">{selectedOption?.emoji ?? "✨"}</span>
        <span>{selectedOption ? selectedOption.label : "React"}</span>
      </button>
      {isOpen && (
        <div className="wish-reaction-picker" role="group" aria-label="Choose a reaction">
          {OPTIONS.map(({ type, emoji, label }) => (
            <button
              className={`wish-reaction-option${selected === type ? " wish-reaction-active" : ""}`}
              type="button"
              key={type}
              aria-label={label}
              aria-pressed={selected === type}
              disabled={isSaving}
              onClick={() => void chooseReaction(type)}
            >
              <span aria-hidden="true">{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
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
