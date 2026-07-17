import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import NewOrganizationForm from "./new-organization-form";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      create: vi.fn(),
    },
  },
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    refresh: mockRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>);

  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.mocked(authClient.organization.create).mockReset();
});

describe("NewOrganizationForm", () => {
  it("derives the slug from the name as the user types", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("Name"), "Acme Corp!");
    expect(screen.getByLabelText("Slug")).toHaveValue("acme-corp");
  });

  it("stops auto-deriving the slug once the user edits it directly", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    await user.type(screen.getByLabelText("Name"), "Acme");
    await user.clear(screen.getByLabelText("Slug"));
    await user.type(screen.getByLabelText("Slug"), "custom-slug");
    await user.type(screen.getByLabelText("Name"), " Corp");

    expect(screen.getByLabelText("Slug")).toHaveValue("custom-slug");
  });

  it("shows validation errors and does not call organization.create for empty input", async () => {
    const user = userEvent.setup();
    render(<NewOrganizationForm />);

    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Slug is required.")).toBeInTheDocument();
    expect(authClient.organization.create).not.toHaveBeenCalled();
  });

  it("creates the organization and redirects to its settings page on success", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: { id: "org-1", name: "Acme Corp!", slug: "acme-corp" },
      error: null,
    } as unknown as ReturnType<typeof authClient.organization.create>);

    render(<NewOrganizationForm />);
    await user.type(screen.getByLabelText("Name"), "Acme Corp!");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => {
      expect(authClient.organization.create).toHaveBeenCalledWith({
        name: "Acme Corp!",
        slug: "acme-corp",
      });
    });
    expect(toast.success).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/org/acme-corp");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows a slug-taken field error without redirecting when the slug collides", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: null,
      error: {
        code: "ORGANIZATION_ALREADY_EXISTS",
        message: "Organization already exists",
      },
    } as unknown as ReturnType<typeof authClient.organization.create>);

    render(<NewOrganizationForm />);
    await user.type(screen.getByLabelText("Name"), "Acme");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    expect(
      await screen.findByText("That slug is already taken."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a toast for any other error", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: null,
      error: { code: "FORBIDDEN", message: "Not allowed" },
    } as unknown as ReturnType<typeof authClient.organization.create>);

    render(<NewOrganizationForm />);
    await user.type(screen.getByLabelText("Name"), "Acme");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not allowed");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
