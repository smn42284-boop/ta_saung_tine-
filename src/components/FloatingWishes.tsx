import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Lantern } from "@/lib/lanterns";

interface FloatingWishesProps {
  messages: Lantern[];
}

interface WishSlot {
  message: Lantern;
  position: number;
  size: "small" | "medium" | "large";
  phase: "visible" | "entering" | "exiting";
}

interface WishPosition {
  column: number;
  row: number;
  spanAllColumns?: boolean;
  columnSpan?: number;
}

function getWishSize(index: number): WishSlot["size"] {
  if (index === 0) return "large";
  if (index < 3) return "medium";
  return "small";
}

function getTargetCount(width: number) {
  if (width < 700) return 2;
  if (width < 1000) return 3;
  if (width < 1400) return 4;
  return 5;
}

function shuffledPositions(count: number, columns: number) {
  const centerPosition: WishPosition = {
    column: columns === 2 ? 0 : Math.floor((columns - 1) / 2),
    row: 0,
    columnSpan: columns === 2 ? 2 : columns === 4 ? 2 : 1,
  };
  const occupiedCenterColumns = new Set(
    Array.from(
      { length: centerPosition.columnSpan ?? 1 },
      (_, offset) => centerPosition.column + offset,
    ),
  );
  const positions = Array.from({ length: columns * 2 }, (_, position) => ({
    column: position % columns,
    row: Math.floor(position / columns),
  })).filter((position) => position.row !== 0 || !occupiedCenterColumns.has(position.column));
  for (let i = positions.length - 1; i > 0; i--) {
    const swap = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[swap]] = [positions[swap]!, positions[i]!];
  }
  return [centerPosition, ...positions.slice(0, count - 1)];
}

export function FloatingWishes({ messages }: FloatingWishesProps) {
  const [targetCount, setTargetCount] = useState(() =>
    typeof window === "undefined" ? 4 : getTargetCount(window.innerWidth),
  );
  const [slots, setSlots] = useState<WishSlot[]>([]);
  const nextMessageRef = useRef(0);
  const swapTimersRef = useRef<number[]>([]);
  const slotsRef = useRef<WishSlot[]>([]);
  const columns = targetCount <= 2 ? 2 : targetCount <= 3 ? 3 : 4;
  const positions = useMemo(
    () => shuffledPositions(Math.min(targetCount, messages.length), columns),
    [columns, messages.length, targetCount],
  );
  const layout = useMemo(() => {
    const result = new Map<number, WishPosition>();
    const longSlots = slots.filter((slot) => slot.message.message.length > 130);

    if (!longSlots.length) {
      slots.forEach((slot, index) => {
        const position = positions[index];
        if (position) result.set(slot.position, position);
      });
      return result;
    }

    longSlots.forEach((slot, row) => {
      result.set(slot.position, { column: 0, row, spanAllColumns: true });
    });

    const shortSlots = slots.filter((slot) => slot.message.message.length <= 130);
    shortSlots.slice(0, columns).forEach((slot, index) => {
      result.set(slot.position, { column: index, row: longSlots.length });
    });
    return result;
  }, [columns, positions, slots]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    const resize = () => setTargetCount(getTargetCount(window.innerWidth));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!messages.length) {
      setSlots([]);
      return;
    }

    const count = Math.min(targetCount, messages.length);
    const createSlot = (message: Lantern, index: number): WishSlot => ({
      message,
      position: index,
      size: getWishSize(index),
      phase: "entering",
    });

    nextMessageRef.current = Math.max(nextMessageRef.current, count);
    setSlots((current) => {
      if (!current.length) {
        return messages.slice(0, count).map(createSlot);
      }

      const currentIds = new Set(messages.map((message) => message.id));
      const retained: WishSlot[] = current
        .filter((slot) => currentIds.has(slot.message.id))
        .slice(0, count)
        .map((slot, index) => ({
          ...slot,
          size: getWishSize(index),
          phase: "visible" as const,
        }));
      const visibleIds = new Set(retained.map((slot) => slot.message.id));
      for (const message of messages) {
        if (retained.length >= count) break;
        if (visibleIds.has(message.id)) continue;
        retained.push(createSlot(message, retained.length));
        visibleIds.add(message.id);
      }
      return retained;
    });

    if (messages.length <= count) return;
    let nextPosition = 0;

    if (count < 1) return;
    const timer = window.setInterval(() => {
      const current = slotsRef.current;
      if (!current.length) return;
      const index = nextPosition++ % current.length;
      let candidate = messages[nextMessageRef.current++ % messages.length]!;
      while (current.some((slot) => slot.message.id === candidate.id)) {
        candidate = messages[nextMessageRef.current++ % messages.length]!;
      }
      const position = current[index]!.position;
      const exiting = current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, phase: "exiting" as const } : slot,
      );
      slotsRef.current = exiting;
      setSlots(exiting);

      const phaseTimer = window.setTimeout(() => {
        const entering = slotsRef.current.map((slot) =>
          slot.position === position
            ? { ...slot, message: candidate, phase: "entering" as const }
            : slot,
        );
        slotsRef.current = entering;
        setSlots(entering);

        const visibleTimer = window.setTimeout(() => {
          const visible = slotsRef.current.map((slot) =>
            slot.position === position ? { ...slot, phase: "visible" as const } : slot,
          );
          slotsRef.current = visible;
          setSlots(visible);
        }, 1400);
        swapTimersRef.current.push(visibleTimer);
      }, 700);
      swapTimersRef.current.push(phaseTimer);
    }, 4800);

    return () => {
      window.clearInterval(timer);
      swapTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      swapTimersRef.current = [];
    };
  }, [messages, targetCount]);

  const longCount = slots.filter((slot) => slot.message.message.length > 130).length;
  const shortCount = slots.length - longCount;
  const rowCount = Math.max(2, longCount + (shortCount > 0 ? 1 : 0));
  const gridStyle = {
    "--wish-columns": columns,
    "--wish-rows": rowCount,
  } as CSSProperties;

  return (
    <div className="wish-field" style={gridStyle} aria-live="polite">
      {slots.map((slot, index) => {
        const position = layout.get(slot.position);
        if (!position) return null;
        const isLong = position.spanAllColumns === true;
        return (
          <p
            key={`${slot.position}-${slot.message.id}`}
            className={`floating-wish floating-wish-${slot.size}${isLong ? " floating-wish-long" : ""} floating-wish-${slot.phase}`}
            style={{
              gridColumn: isLong
                ? "1 / -1"
                : position.columnSpan
                  ? `${position.column + 1} / span ${position.columnSpan}`
                  : String(position.column + 1),
              gridRow: String(position.row + 1),
              animationDelay: `${(index % 4) * 0.25}s`,
            }}
          >
            <span className="floating-wish-message">{slot.message.message}</span>
            {slot.message.name && (
              <span className="floating-wish-author">— {slot.message.name}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}
