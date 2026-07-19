import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import TokenBalance from "@/app/components/TokenBalance";
import { Economy } from "@/lib/platform/economy";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { getPlayerId } from "@/lib/platform/player";
import { notifyBalanceChanged } from "@/lib/platform/balanceBus";

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

  it("live-refreshes when the balance bus fires", async () => {
    render(<TokenBalance />);
    expect(await screen.findByText("0")).toBeInTheDocument();
    await act(async () => {
      notifyBalanceChanged(17);
    });
    await waitFor(() => expect(screen.getByText("17")).toBeInTheDocument());
  });
});
