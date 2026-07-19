import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Pong from "@/app/games/pong/index";

describe("Pong platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<Pong />);
    // Button reads "START" before play, "PLAY AGAIN" after a game over.
    expect(screen.getByRole("button", { name: "START" })).toBeInTheDocument();
  });

  // RED-FIRST: fails before the migration, because an unmigrated Pong never
  // calls useCartridge and so never establishes a player identity.
  // Driving a real canvas match to a win in jsdom is impractical, so this
  // asserts the platform wiring exists rather than the win path itself.
  it("is wired to the platform on mount", async () => {
    render(<Pong />);
    await waitFor(() => expect(localStorage.getItem("bg:playerId")).not.toBeNull());
  });

  it("does not write legacy localStorage keys", () => {
    render(<Pong />);
    const stray = Object.keys(localStorage).filter(
      (k) => k.startsWith("pong-") && !k.startsWith("bg:"),
    );
    expect(stray).toEqual([]);
  });
});
