import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { signOut, authClient } from "@/lib/auth-client";
import { Navbar } from "@/components/navbar";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

// base-ui AvatarImage never mounts in jsdom (no image-loading events fire).
// Replace the ui/avatar module with simple HTML equivalents so we can verify
// the src prop is forwarded without needing a real network layer.
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, ...props }: React.ComponentPropsWithoutRef<"span">) => (
    <span data-slot="avatar" {...props}>
      {children}
    </span>
  ),
  AvatarImage: ({
    src,
    alt,
    ...props
  }: React.ComponentPropsWithoutRef<"img">) =>
    // eslint-disable-next-line @next/next/no-img-element -- test mock of AvatarImage
    src ? <img src={src} alt={alt} {...props} /> : null,
  AvatarFallback: ({
    children,
    ...props
  }: React.ComponentPropsWithoutRef<"span">) => (
    <span data-slot="avatar-fallback" {...props}>
      {children}
    </span>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
  authClient: {
    useListOrganizations: vi.fn(),
    useActiveOrganization: vi.fn(),
    organization: {
      setActive: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

// next/link renders a plain <a> in tests
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Navbar", () => {
  let mockPush: ReturnType<typeof vi.fn>;
  let mockRefresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPush = vi.fn();
    mockRefresh = vi.fn();
    // Partial mock of the router shape (only the two methods this component
    // calls) — doesn't structurally satisfy the full AppRouterInstance, so a
    // direct cast is rejected under strict mode. Route through `unknown`
    // (as tsc's own error message suggests) since we're intentionally
    // narrowing to only what's used.
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(signOut).mockResolvedValue(undefined as never);

    // Default org-switcher state: no orgs, no active org. Individual tests
    // override with vi.mocked(...).mockReturnValue(...) as needed. Cast
    // through `unknown` per the repo's partial-mock convention (these mocks
    // only implement `data`, not the full nanostore-query return shape).
    vi.mocked(authClient.useListOrganizations).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof authClient.useListOrganizations>);
    vi.mocked(authClient.useActiveOrganization).mockReturnValue({
      data: null,
    } as unknown as ReturnType<typeof authClient.useActiveOrganization>);
  });

  describe("logged out (user=null)", () => {
    it("shows 'Sign in with Google' button", () => {
      render(<Navbar user={null} />);
      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show the user menu trigger", () => {
      render(<Navbar user={null} />);
      expect(
        screen.queryByRole("button", { name: "User menu" }),
      ).not.toBeInTheDocument();
    });

    it("brand link 'Starter Kit' points to '/'", () => {
      render(<Navbar user={null} />);
      const link = screen.getByRole("link", { name: "Starter Kit" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/");
    });

    it("theme toggle is present", () => {
      render(<Navbar user={null} />);
      expect(
        screen.getByRole("button", { name: "Toggle theme" }),
      ).toBeInTheDocument();
    });
  });

  describe("initials helper (via AvatarFallback)", () => {
    // [name, email, expected fallback]. "Anne Marie Dupont" → first+last word "AD".
    const cases: [string, string, string][] = [
      ["Marcos Vilela", "mv@example.com", "MV"],
      ["Anne Marie Dupont", "anne@example.com", "AD"],
      ["Marcos", "m@example.com", "MA"],
      ["X", "x@example.com", "X"],
      ["", "alice@example.com", "A"],
      ["", "1bob@x.com", "1"],
      ["", "", "?"],
    ];

    it.each(cases)(
      "name=%j email=%j → fallback text %j",
      async (name, email, expected) => {
        render(<Navbar user={{ name, email, image: null }} />);
        // Scoped to the fallback element specifically — for a 1-character
        // name the header bar's own name text can coincide with the fallback
        // initial (e.g. name "X" → both render "X"), so an unscoped
        // getByText would match twice.
        await waitFor(() => {
          expect(
            screen.getByText(expected, {
              selector: '[data-slot="avatar-fallback"]',
            }),
          ).toBeInTheDocument();
        });
      },
    );
  });

  describe("logged in", () => {
    const loggedInUser = {
      name: "Marcos Vilela",
      email: "marcos@example.com",
      image: null as string | null,
    };

    it("shows the avatar trigger with aria-label 'User menu'", () => {
      render(<Navbar user={loggedInUser} />);
      expect(
        screen.getByRole("button", { name: "User menu" }),
      ).toBeInTheDocument();
    });

    it("shows the user's name in the header bar without opening the menu", () => {
      render(<Navbar user={loggedInUser} />);
      expect(screen.getByText("Marcos Vilela")).toBeInTheDocument();
    });

    it("does not show an org name in the header bar when there is no active org", () => {
      render(<Navbar user={loggedInUser} />);
      // Default mock state (set in the top-level beforeEach) is no active org.
      expect(screen.queryByText("Org One")).not.toBeInTheDocument();
    });

    it("shows the active org's name next to the username in the header bar", () => {
      vi.mocked(authClient.useActiveOrganization).mockReturnValue({
        data: { id: "org-1", name: "Org One", slug: "org-one" },
      } as unknown as ReturnType<typeof authClient.useActiveOrganization>);

      render(<Navbar user={loggedInUser} />);
      expect(screen.getByText("Org One")).toBeInTheDocument();
    });

    it("'Profile' and 'Sign out' are NOT visible before opening the menu", () => {
      render(<Navbar user={loggedInUser} />);
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });

    it("after clicking User menu the dropdown shows name, email, Profile link, and Sign out", async () => {
      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);

      await user.click(screen.getByRole("button", { name: "User menu" }));

      // Scoped to the menu popup — "Marcos Vilela" also renders in the
      // always-visible header bar, so an unscoped query would match twice.
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("Marcos Vilela")).toBeInTheDocument();
      expect(within(menu).getByText("marcos@example.com")).toBeInTheDocument();

      const profileLink = within(menu).getByRole("link", { name: "Profile" });
      expect(profileLink).toBeInTheDocument();
      expect(profileLink).toHaveAttribute("href", "/profile");

      expect(await screen.findByText("Sign out")).toBeInTheDocument();
    });

    it("clicking 'Sign out' calls signOut once, then router.refresh", async () => {
      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);

      await user.click(screen.getByRole("button", { name: "User menu" }));
      const signOutItem = await screen.findByText("Sign out");
      await user.click(signOutItem);

      await waitFor(() => {
        expect(signOut).toHaveBeenCalledOnce();
        expect(mockRefresh).toHaveBeenCalledOnce();
      });
    });

    it("when image is provided the avatar img has that src", () => {
      const imgUser = {
        ...loggedInUser,
        image: "https://example.com/avatar.png",
      };
      render(<Navbar user={imgUser} />);
      // The mocked AvatarImage renders a real <img> when src is provided
      const img = screen.getByRole("img", { name: loggedInUser.name });
      expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
    });
  });

  describe("org switcher", () => {
    const loggedInUser = {
      name: "Marcos Vilela",
      email: "marcos@example.com",
      image: null as string | null,
    };

    it("lists the user's organizations and marks the active one", async () => {
      vi.mocked(authClient.useListOrganizations).mockReturnValue({
        data: [
          { id: "org-1", name: "Org One" },
          { id: "org-2", name: "Org Two" },
        ],
      } as unknown as ReturnType<typeof authClient.useListOrganizations>);
      vi.mocked(authClient.useActiveOrganization).mockReturnValue({
        data: { id: "org-2", name: "Org Two" },
      } as unknown as ReturnType<typeof authClient.useActiveOrganization>);

      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      // Scoped to the menu — the active org ("Org Two") also renders in the
      // always-visible header bar, so an unscoped query would match twice.
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("Org One")).toBeInTheDocument();
      expect(within(menu).getByText("Org Two")).toBeInTheDocument();
    });

    it("clicking an organization calls setActive with its id, then router.refresh", async () => {
      vi.mocked(authClient.useListOrganizations).mockReturnValue({
        data: [{ id: "org-1", name: "Org One" }],
      } as unknown as ReturnType<typeof authClient.useListOrganizations>);
      vi.mocked(authClient.organization.setActive).mockResolvedValue(
        undefined as never,
      );

      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);
      await user.click(screen.getByRole("button", { name: "User menu" }));
      await user.click(await screen.findByText("Org One"));

      await waitFor(() => {
        expect(authClient.organization.setActive).toHaveBeenCalledWith({
          organizationId: "org-1",
        });
        expect(mockRefresh).toHaveBeenCalledOnce();
      });
    });

    it("shows an 'Organization settings' link to the active org's slug when one is set", async () => {
      vi.mocked(authClient.useActiveOrganization).mockReturnValue({
        data: { id: "org-2", name: "Org Two", slug: "org-two" },
      } as unknown as ReturnType<typeof authClient.useActiveOrganization>);

      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      const link = await screen.findByRole("link", {
        name: "Organization settings",
      });
      expect(link).toHaveAttribute("href", "/org/org-two");
    });

    it("does not show an 'Organization settings' link when there is no active org", async () => {
      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      expect(
        screen.queryByRole("link", { name: "Organization settings" }),
      ).not.toBeInTheDocument();
    });

    it("shows a 'New organization' link pointing to the dedicated create page", async () => {
      const user = userEvent.setup();
      render(<Navbar user={loggedInUser} />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      const link = await screen.findByRole("link", {
        name: "New organization",
      });
      expect(link).toHaveAttribute("href", "/org/new");
    });
  });
});
