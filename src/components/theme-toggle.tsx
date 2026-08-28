"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Both icons are always rendered and swapped by the `dark:` variant rather than
 * by React state. The server has no idea which theme the browser will resolve,
 * so picking one icon at render time is a hydration mismatch; CSS has the answer
 * before React does, because next-themes sets `.dark` in a blocking script.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
