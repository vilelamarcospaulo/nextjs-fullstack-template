import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { generateGreeting } from "@/app/actions";
import Greeter from "./greeter";

vi.mock("@/app/actions", () => ({
  generateGreeting: vi.fn(),
}));

const mockGenerateGreeting = vi.mocked(generateGreeting);

beforeEach(() => {
  mockGenerateGreeting.mockReset();
});

describe("Greeter", () => {
  it("renders with placeholder input, submit button, and no result block", () => {
    render(<Greeter />);

    expect(screen.getByPlaceholderText("Enter a name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run Server Action" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    // No <pre> rendered yet
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("typing into the input updates its value", async () => {
    const user = userEvent.setup();
    render(<Greeter />);

    const input = screen.getByPlaceholderText("Enter a name");
    await user.type(input, "Alice");
    expect(input).toHaveValue("Alice");
  });

  it("submit calls generateGreeting once with the typed name and renders the result", async () => {
    const user = userEvent.setup();
    mockGenerateGreeting.mockResolvedValue(
      "Hello, Alice — generated on the server at 2026-01-01T00:00:00.000Z.",
    );

    render(<Greeter />);

    await user.type(screen.getByPlaceholderText("Enter a name"), "Alice");
    await user.click(screen.getByRole("button", { name: "Run Server Action" }));

    expect(mockGenerateGreeting).toHaveBeenCalledTimes(1);
    expect(mockGenerateGreeting).toHaveBeenCalledWith("Alice");

    await screen.findByText(/Hello, Alice/);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent("Hello, Alice");
  });

  it("shows pending label and disabled button while action is unresolved, then re-enables", async () => {
    const user = userEvent.setup();

    let resolve: (value: string) => void;
    const deferred = new Promise<string>((res) => {
      resolve = res;
    });
    mockGenerateGreeting.mockReturnValue(deferred);

    render(<Greeter />);

    await user.type(screen.getByPlaceholderText("Enter a name"), "Bob");
    await user.click(screen.getByRole("button", { name: "Run Server Action" }));

    // During pending
    const btn = screen.getByRole("button", { name: "Running…" });
    expect(btn).toBeDisabled();

    // Resolve
    resolve!("Hello, Bob — done.");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run Server Action" }),
      ).not.toBeDisabled(),
    );
  });

  it("submitting again with a new name replaces the previous result", async () => {
    const user = userEvent.setup();
    mockGenerateGreeting
      .mockResolvedValueOnce("Hello, First.")
      .mockResolvedValueOnce("Hello, Second.");

    render(<Greeter />);

    const input = screen.getByPlaceholderText("Enter a name");

    await user.type(input, "First");
    await user.click(screen.getByRole("button", { name: "Run Server Action" }));
    await screen.findByText("Hello, First.");

    await user.clear(input);
    await user.type(input, "Second");
    await user.click(screen.getByRole("button", { name: "Run Server Action" }));
    await screen.findByText("Hello, Second.");

    expect(screen.queryByText("Hello, First.")).not.toBeInTheDocument();
  });
});
