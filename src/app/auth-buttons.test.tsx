import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "@/lib/auth-client";
import { SignInButton } from "@/app/auth-buttons";

vi.mock("@/lib/auth-client", () => ({
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

describe("SignInButton", () => {
  beforeEach(() => {
    vi.mocked(signIn.social).mockResolvedValue(undefined as never);
  });

  it("renders with 'Sign in with Google' label and a Google SVG icon", () => {
    render(<SignInButton />);
    expect(
      screen.getByRole("button", { name: /sign in with google/i }),
    ).toBeInTheDocument();
    // GoogleIcon renders an aria-hidden SVG inside the button
    const btn = screen.getByRole("button", { name: /sign in with google/i });
    expect(btn.querySelector("svg")).toBeInTheDocument();
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("click calls signIn.social once with { provider: 'google', callbackURL: '/' } (default provider)", async () => {
    const user = userEvent.setup();
    render(<SignInButton />);
    await user.click(
      screen.getByRole("button", { name: /sign in with google/i }),
    );
    expect(signIn.social).toHaveBeenCalledOnce();
    expect(signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
  });

  it("passes an explicit provider prop through to signIn.social", async () => {
    const user = userEvent.setup();
    render(<SignInButton provider="github" />);
    await user.click(
      screen.getByRole("button", { name: /sign in with google/i }),
    );
    expect(signIn.social).toHaveBeenCalledOnce();
    expect(signIn.social).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/",
    });
  });

  it("while the social() promise is pending the button is disabled and shows 'Signing in…'", async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    vi.mocked(signIn.social).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    render(<SignInButton />);

    const btn = screen.getByRole("button", { name: /sign in with google/i });
    // Not disabled before click
    expect(btn).not.toBeDisabled();

    await user.click(btn);

    // After click, while promise is still pending — query by text since
    // disabled buttons may be hidden from accessible role queries
    await waitFor(() => {
      const pendingBtn = screen.getByText(/signing in/i).closest("button");
      expect(pendingBtn).toBeInTheDocument();
      expect(pendingBtn).toBeDisabled();
    });

    // Resolving re-enables the button (setPending(false) runs in finally).
    resolve(undefined);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).not.toBeDisabled(),
    );
  });
});
