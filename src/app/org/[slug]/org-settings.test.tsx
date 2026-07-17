import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { addMemberByEmail } from "@/app/org/actions";
import OrgSettings from "./org-settings";

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
      update: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    },
  },
}));

vi.mock("@/app/org/actions", () => ({
  addMemberByEmail: vi.fn(),
}));

const mockRefresh = vi.fn();

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    refresh: mockRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>);

  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  mockRefresh.mockReset();
  vi.mocked(authClient.organization.update).mockReset();
  vi.mocked(authClient.organization.updateMemberRole).mockReset();
  vi.mocked(authClient.organization.removeMember).mockReset();
  vi.mocked(addMemberByEmail).mockReset();
});

const organization = { id: "org-1", name: "Acme Inc", slug: "acme-inc" };

const members = [
  {
    id: "member-owner",
    userId: "user-owner",
    role: "owner",
    user: {
      id: "user-owner",
      name: "Olivia Owner",
      email: "olivia@example.com",
      image: null,
    },
  },
  {
    id: "member-bob",
    userId: "user-bob",
    role: "member",
    user: {
      id: "user-bob",
      name: "Bob",
      email: "bob@example.com",
      image: null,
    },
  },
];

describe("OrgSettings — as a member (no manage permissions)", () => {
  function renderAsMember() {
    return render(
      <OrgSettings
        organization={organization}
        viewerRole="member"
        viewerUserId="user-bob"
        members={members}
      />,
    );
  }

  it("shows org name and slug, but no rename save button", () => {
    renderAsMember();
    expect(screen.getByLabelText("Name")).toHaveValue("Acme Inc");
    expect(screen.getByText(/acme-inc/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save name/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show role selects, remove buttons, or the add-member form", () => {
    renderAsMember();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/add an existing member/i),
    ).not.toBeInTheDocument();
  });

  it("renders both members' roles as plain text", () => {
    renderAsMember();
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getAllByText("member").length).toBeGreaterThan(0);
  });
});

describe("OrgSettings — as an admin (manage permissions)", () => {
  function renderAsAdmin() {
    return render(
      <OrgSettings
        organization={organization}
        viewerRole="admin"
        viewerUserId="user-owner"
        members={members}
      />,
    );
  }

  it("renames the organization on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.organization.update).mockResolvedValue(
      {} as unknown as ReturnType<typeof authClient.organization.update>,
    );
    renderAsAdmin();

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    await waitFor(() => {
      expect(authClient.organization.update).toHaveBeenCalledWith({
        organizationId: "org-1",
        data: { name: "New Name" },
      });
    });
    expect(toast.success).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows a validation error and does not call update when name is cleared", async () => {
    const user = userEvent.setup();
    renderAsAdmin();

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: /save name/i }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(authClient.organization.update).not.toHaveBeenCalled();
  });

  it("hides role/remove controls on the viewer's own row but shows them for others", () => {
    renderAsAdmin();
    // One combobox for Bob's row (the only other member) + one for the
    // add-member-by-email form's role select.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(1);
  });

  it("changes a member's role", async () => {
    vi.mocked(authClient.organization.updateMemberRole).mockResolvedValue(
      {} as unknown as ReturnType<
        typeof authClient.organization.updateMemberRole
      >,
    );
    renderAsAdmin();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /role for bob/i }),
      "admin",
    );

    await waitFor(() => {
      expect(authClient.organization.updateMemberRole).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-bob",
        role: "admin",
      });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.organization.removeMember).mockResolvedValue(
      {} as unknown as ReturnType<typeof authClient.organization.removeMember>,
    );
    renderAsAdmin();

    await user.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(authClient.organization.removeMember).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberIdOrEmail: "member-bob",
      });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("adds a member by email on success", async () => {
    const user = userEvent.setup();
    vi.mocked(addMemberByEmail).mockResolvedValue({ ok: true });
    renderAsAdmin();

    await user.type(
      screen.getByLabelText(/add an existing member/i),
      "new@example.com",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(addMemberByEmail).toHaveBeenCalledWith(
        "org-1",
        "new@example.com",
        "member",
      );
    });
    expect(toast.success).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows a mapped error message when adding a member fails", async () => {
    const user = userEvent.setup();
    vi.mocked(addMemberByEmail).mockResolvedValue({
      ok: false,
      error: "no_account_with_that_email",
    });
    renderAsAdmin();

    await user.type(
      screen.getByLabelText(/add an existing member/i),
      "ghost@example.com",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(
      await screen.findByText(/no account exists with that email/i),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
