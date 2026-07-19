import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LightsOut from "@/app/games/lights-out/index";

describe("LightsOut platform migration", () => {
  beforeEach(() => localStorage.clear());

  it("renders without crashing", () => {
    render(<LightsOut />);
    expect(screen.getByText(/BEST/i)).toBeInTheDocument();
  });

  it("shows the legacy best level through the platform", async () => {
    localStorage.setItem("lightsout-best", "7");
    render(<LightsOut />);
    expect(await screen.findByText("7")).toBeInTheDocument();
  });
});
