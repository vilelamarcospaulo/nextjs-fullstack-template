import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiHelloDemo from "./api-hello-demo";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockFetch = () => vi.mocked(fetch);

describe("ApiHelloDemo", () => {
  it("renders with the button label and no result block", () => {
    render(<ApiHelloDemo />);

    expect(
      screen.getByRole("button", { name: "Call /api/hello" }),
    ).toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("clicking the button calls fetch once with /api/hello", async () => {
    const user = userEvent.setup();
    const responseBody = { message: "hello" };
    mockFetch().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ApiHelloDemo />);
    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));

    expect(mockFetch()).toHaveBeenCalledTimes(1);
    expect(mockFetch()).toHaveBeenCalledWith("/api/hello");

    await waitFor(() =>
      expect(document.querySelector("pre")).toBeInTheDocument(),
    );
  });

  it("shows pending label and disables button while fetch is unresolved, then re-enables", async () => {
    const user = userEvent.setup();

    let resolve: (value: Response) => void;
    const deferred = new Promise<Response>((res) => {
      resolve = res;
    });
    mockFetch().mockReturnValue(deferred);

    render(<ApiHelloDemo />);
    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));

    const btn = screen.getByRole("button", { name: "Fetching…" });
    expect(btn).toBeDisabled();

    resolve!(
      new Response(JSON.stringify({ message: "hi" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Call /api/hello" }),
      ).not.toBeDisabled(),
    );
  });

  it("renders pretty-printed JSON in a <pre> on success", async () => {
    const user = userEvent.setup();
    const responseBody = { greeting: "Hello, World!", timestamp: "2026-01-01" };
    mockFetch().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ApiHelloDemo />);
    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));

    const pre = await screen.findByText(/greeting/);
    expect(pre.textContent).toContain('"greeting"');
    expect(pre.textContent).toContain('"Hello, World!"');
    expect(pre.textContent).toContain('"timestamp"');
  });

  it("second click replaces the previous result", async () => {
    const user = userEvent.setup();
    mockFetch()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ round: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ round: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(<ApiHelloDemo />);

    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));
    await screen.findByText(/"round"/);
    expect(document.querySelector("pre")?.textContent).toContain('"round": 1');

    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));
    await waitFor(() =>
      expect(document.querySelector("pre")?.textContent).toContain(
        '"round": 2',
      ),
    );
    expect(document.querySelector("pre")?.textContent).not.toContain(
      '"round": 1',
    );
  });

  it("shows an error message and re-enables the button after a fetch rejection", async () => {
    const user = userEvent.setup();
    mockFetch().mockRejectedValue(new Error("Network failure"));

    render(<ApiHelloDemo />);
    await user.click(screen.getByRole("button", { name: "Call /api/hello" }));

    expect(
      await screen.findByText("Failed to reach /api/hello."),
    ).toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Call /api/hello" }),
    ).not.toBeDisabled();
  });
});
