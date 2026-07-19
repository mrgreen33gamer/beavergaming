import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameFrame from "@/app/play/[slug]/GameFrame";

describe("GameFrame", () => {
  it("wraps the game in the shared shell chrome", async () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
    // GameLoading remains covered by its own unit tests; chunk resolve is
    // covered by allGamesMount + this mount of the real Pong default export.
    expect(await screen.findByRole("button", { name: "START" })).toBeInTheDocument();
  });

  it("renders the loaded game once its chunk resolves", async () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(await screen.findByRole("button", { name: "START" })).toBeInTheDocument();
  });

  it("still offers mute audio chrome", () => {
    render(<GameFrame slug="pong" title="Pong" accent="#ff6b1a" />);
    expect(screen.getByRole("button", { name: /mute audio|unmute audio/i })).toBeInTheDocument();
  });
});
