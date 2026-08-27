import { Info } from "lucide-react";

/**
 * §9.3 — "the 1:1 editor shows this guidance as persistent helper text, NOT a
 * dismissible one-time notice."
 *
 * So there is deliberately no dismiss control, no localStorage "seen" flag and
 * no collapse state. It renders with the page, every time. The point is that it
 * is in view at the moment someone is deciding what to type, which a notice
 * acknowledged once months ago would not be.
 */
export function GuidancePanel() {
  return (
    <aside className="bg-muted/40 space-y-2 rounded-lg border p-3 text-[13px]">
      <p className="flex items-center gap-1.5 font-medium">
        <Info className="size-3.5 shrink-0" />
        What belongs here
      </p>
      <p className="text-muted-foreground">
        Development goals, skill growth areas, project ownership interests,
        delivery observations, factual summaries of what was discussed.
      </p>
      <p className="text-muted-foreground">
        <span className="text-foreground font-medium">Not here:</span> health
        information, personal or family circumstances, verbatim transcripts,
        disciplinary matters, compensation discussions, or anything about a
        person other than this report.
      </p>
      <p className="border-t pt-2">
        A useful test before typing:{" "}
        <em>would I be comfortable if this person read this exact sentence?</em>{" "}
        If not, either it should not be written down, or it belongs in a formal
        channel.
      </p>
    </aside>
  );
}
