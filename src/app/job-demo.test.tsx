import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobActionResult } from "@/app/actions";
import { submitHelloJob } from "@/app/actions";
import JobDemo from "./job-demo";

vi.mock("@/app/actions", () => ({
  submitHelloJob: vi.fn(),
}));

const mockSubmitHelloJob = vi.mocked(submitHelloJob);

beforeEach(() => {
  mockSubmitHelloJob.mockReset();
});

describe("JobDemo", () => {
  it("renders with placeholder input, submit button, and no result block", () => {
    render(<JobDemo />);

    expect(screen.getByPlaceholderText("Enter a message")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enqueue Job" }),
    ).toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("typing into the input updates its value", async () => {
    const user = userEvent.setup();
    render(<JobDemo />);

    const input = screen.getByPlaceholderText("Enter a message");
    await user.type(input, "Hello there");
    expect(input).toHaveValue("Hello there");
  });

  it("submit calls submitHelloJob once with the typed message and renders the job id", async () => {
    const user = userEvent.setup();
    const okResult: JobActionResult = {
      ok: true,
      data: { jobId: "abc-123" },
    };
    mockSubmitHelloJob.mockResolvedValue(okResult);

    render(<JobDemo />);

    await user.type(screen.getByPlaceholderText("Enter a message"), "Hi");
    await user.click(screen.getByRole("button", { name: "Enqueue Job" }));

    expect(mockSubmitHelloJob).toHaveBeenCalledTimes(1);
    expect(mockSubmitHelloJob).toHaveBeenCalledWith("Hi");

    await screen.findByText(/Job enqueued: abc-123/);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent("Job enqueued: abc-123");
  });

  it("shows pending label and disabled button while action is unresolved, then re-enables", async () => {
    const user = userEvent.setup();

    let resolve: (value: JobActionResult) => void;
    const deferred = new Promise<JobActionResult>((res) => {
      resolve = res;
    });
    mockSubmitHelloJob.mockReturnValue(deferred);

    render(<JobDemo />);

    await user.type(screen.getByPlaceholderText("Enter a message"), "Hi");
    await user.click(screen.getByRole("button", { name: "Enqueue Job" }));

    const btn = screen.getByRole("button", { name: "Enqueuing…" });
    expect(btn).toBeDisabled();

    resolve!({ ok: true, data: { jobId: "xyz-789" } });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enqueue Job" }),
      ).not.toBeDisabled(),
    );
  });

  it("unauthenticated result renders sign-in prompt and no <pre>", async () => {
    const user = userEvent.setup();
    const unauthResult: JobActionResult = {
      ok: false,
      error: "unauthenticated",
    };
    mockSubmitHelloJob.mockResolvedValue(unauthResult);

    render(<JobDemo />);

    await user.click(screen.getByRole("button", { name: "Enqueue Job" }));

    await screen.findByText(/sign in/i);
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("generic error result renders fallback error message and no <pre>", async () => {
    const user = userEvent.setup();
    const errResult: JobActionResult = {
      ok: false,
      error: "Message must be 200 characters or fewer.",
    };
    mockSubmitHelloJob.mockResolvedValue(errResult);

    render(<JobDemo />);

    await user.click(screen.getByRole("button", { name: "Enqueue Job" }));

    await screen.findByText(/something went wrong/i);
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });
});
