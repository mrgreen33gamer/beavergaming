import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Asteroids from "@/app/games/asteroids";

describe("Asteroids platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<Asteroids />);
    expect(screen.getByText(/BEST/i)).toBeInTheDocument();
  });

  it("shows the legacy high score through the platform", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    render(<Asteroids />);
    expect(await screen.findByText("4200")).toBeInTheDocument();
  });
});
