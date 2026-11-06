import { Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  MAX_NICK,
  MAX_WISH,
  OFFICE_LOCATIONS,
  validateWish,
  type LanternLocation,
} from "@/lib/lanterns";

interface VisitorWishFormProps {
  onSubmit: (input: {
    name: string;
    message: string;
    officeLocation: LanternLocation;
  }) => Promise<void>;
  onSuccess: () => void;
}

export function VisitorWishForm({ onSubmit, onSuccess }: VisitorWishFormProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<LanternLocation>("HTY");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const validationError = validateWish(message);
    if (validationError) {
      setError(validationError);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, message, officeLocation: location });
      setSubmitted(true);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your wish could not be saved.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="visitor-success wish-card p-6 text-center animate-in fade-in zoom-in-95">
        <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-3 font-serif text-xl font-bold text-foreground">
          Your wish has joined the festival collection!
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          It will appear on the festival sky after admin approval.
        </p>
        <Link
          to="/display"
          className="visitor-success-link inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow"
        >
          VIEW THE FESTIVAL SKY
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="wish-card space-y-4 p-5" noValidate>
      <div>
        <label htmlFor="nick" className="text-sm font-medium text-foreground">
          Nickname <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="nick"
          value={name}
          maxLength={MAX_NICK}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Aye Aye"
          className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="location" className="text-sm font-medium text-foreground">
          Office Location
        </label>
        <select
          id="location"
          value={location}
          onChange={(event) => {
            const selected = event.target.value;
            if (OFFICE_LOCATIONS.includes(selected as LanternLocation)) {
              setLocation(selected as LanternLocation);
            }
          }}
          className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {OFFICE_LOCATIONS.map((office) => (
            <option key={office} value={office}>
              {office}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="flex justify-between gap-3">
          <label htmlFor="wish" className="text-sm font-medium text-foreground">
            Your festival wish
          </label>
          <span className="shrink-0 text-xs text-muted-foreground">
            {message.length}/{MAX_WISH}
          </span>
        </div>
        <textarea
          id="wish"
          value={message}
          rows={4}
          maxLength={MAX_WISH}
          onChange={(event) => {
            setMessage(event.target.value);
            if (error) setError(null);
          }}
          placeholder="May our town shine bright…"
          aria-invalid={!!error}
          className="mt-1.5 w-full resize-y rounded-xl border border-input bg-background/60 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-sans text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        {submitting ? "SENDING YOUR WISH…" : "LIGHT MY LANTERN"}
      </button>
    </form>
  );
}
