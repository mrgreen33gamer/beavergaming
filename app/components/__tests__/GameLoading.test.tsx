import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameLoading from "@/app/components/GameLoading";

describe("GameLoading", () => {
  it("names the game being loaded", () => {
    render(<GameLoading title="Asteroids" accent="#ff6b1a" />);
    expect(screen.getByText(/asteroids/i)).toBeInTheDocument();
  });

  it("exposes a busy status to assistive tech", () => {
    render(<GameLoading title="Asteroids" accent="#ff6b1a" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
