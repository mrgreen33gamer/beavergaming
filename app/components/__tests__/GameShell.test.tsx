import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameShell from "@/app/components/GameShell";
import {
  isGamePaused,
  __resetGamePause,
} from "@/lib/platform/pauseBus";

const meta = { id: "pong", runtime: "canvas" as const };

beforeEach(() => {
  __resetGamePause();
});

describe("GameShell", () => {
  it("renders its child game", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div data-testid="game">GAME</div>
      </GameShell>,
    );
    expect(screen.getByTestId("game")).toBeInTheDocument();
  });

  it("shows a pause button by default", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("hides the pause button when the game handles its own pause", () => {
    render(
      <GameShell meta={{ ...meta, supportsPause: false }} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
  });

  it("opens the pause overlay when paused", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it("resumes from the pause overlay", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    await user.click(screen.getByRole("button", { name: /resume/i }));
    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument();
  });

  it("offers a fullscreen control", () => {
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(screen.getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
  });

  it("toggles the mute control", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    await user.click(screen.getByRole("button", { name: /mute audio/i }));
    expect(screen.getByRole("button", { name: /unmute audio/i })).toBeInTheDocument();
  });

  it("publishes pause state on the global pause bus", async () => {
    const user = userEvent.setup();
    render(
      <GameShell meta={meta} accent="#ff6b1a">
        <div />
      </GameShell>,
    );
    expect(isGamePaused()).toBe(false);
    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(isGamePaused()).toBe(true);
    await user.click(screen.getByRole("button", { name: /resume/i }));
    expect(isGamePaused()).toBe(false);
  });
});
