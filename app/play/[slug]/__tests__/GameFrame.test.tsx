import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameFrame from "@/app/play/[slug]/GameFrame";

// Canvas games are safe to render here: all 28 guard `if (!ctx) return`,
// so the game mounts and its draw effect bails out under jsdom.
describe("GameFrame", () => {
  it("shows the loading screen while the chunk resolves", () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("PONG")).toBeInTheDocument();
  });

  it("wraps the game in the shared shell chrome", () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
  });

  it("renders the loaded game once its chunk resolves", async () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(await screen.findByRole("button", { name: "START" })).toBeInTheDocument();
  });
});
