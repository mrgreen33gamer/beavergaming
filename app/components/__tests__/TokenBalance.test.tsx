import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenBalance from "@/app/components/TokenBalance";
import { Economy } from "@/lib/platform/economy";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { getPlayerId } from "@/lib/platform/player";

describe("TokenBalance", () => {
  beforeEach(() => localStorage.clear());

  it("shows zero for a new player", async () => {
    render(<TokenBalance />);
    expect(await screen.findByText("0")).toBeInTheDocument();
  });

  it("labels the currency as B-Tokens", async () => {
    render(<TokenBalance />);
    expect(await screen.findByLabelText(/b-tokens/i)).toBeInTheDocument();
  });

  it("shows an existing balance", async () => {
    const economy = new Economy(new LocalStorageAdapter(), getPlayerId());
    await economy.applyScore("pong", 100 * 25); // +25
    render(<TokenBalance />);
    expect(await screen.findByText("25")).toBeInTheDocument();
  });
});
