import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrashErrorBoundary } from "../Viewport";

function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error("kaboom");
  return <div>alive</div>;
}

describe("CrashErrorBoundary", () => {
  it("shows a Retry fallback when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CrashErrorBoundary>
        <Boom crash />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText(/rendering hiccup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <CrashErrorBoundary>
        <Boom crash={false} />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText("alive")).toBeInTheDocument();
  });

  it("clears the error and re-renders children on Retry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let crash = true;
    function Toggle() {
      return <Boom crash={crash} />;
    }
    render(
      <CrashErrorBoundary>
        <Toggle />
      </CrashErrorBoundary>,
    );
    expect(screen.getByText(/rendering hiccup/i)).toBeInTheDocument();
    crash = false; // next render will succeed
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByText("alive")).toBeInTheDocument();
    spy.mockRestore();
  });
});
