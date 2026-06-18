import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ProfileForm, { type ProfileFormInitial } from "./profile-form";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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
  } as ReturnType<typeof useRouter>);

  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();

  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const defaultInitial: ProfileFormInitial = {
  name: "Alice Smith",
  image: "https://example.com/alice.jpg",
  birthdate: "1990-06-15",
  bio: "Hello world",
  location: "New York, US",
};

function renderForm(
  initial: ProfileFormInitial = defaultInitial,
  email = "alice@example.com",
) {
  return render(<ProfileForm initial={initial} email={email} />);
}

describe("ProfileForm — initial render", () => {
  it("populates all five fields with initial values", () => {
    renderForm();

    expect(screen.getByLabelText(/^Name/)).toHaveValue("Alice Smith");
    expect(screen.getByLabelText("Avatar URL")).toHaveValue(
      "https://example.com/alice.jpg",
    );
    expect(screen.getByLabelText("Birthdate")).toHaveValue("1990-06-15");
    expect(screen.getByLabelText("Bio")).toHaveValue("Hello world");
    expect(screen.getByLabelText("Location")).toHaveValue("New York, US");
  });

  it("shows avatar fallback letter from name", () => {
    renderForm();
    expect(screen.getByText("A")).toBeInTheDocument(); // "Alice Smith"[0].toUpperCase()
  });

  it("shows avatar fallback from email when name is empty", () => {
    renderForm({ ...defaultInitial, name: "" }, "bob@example.com");
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows bio character counter as <len>/280", () => {
    renderForm();
    // "Hello world" is 11 chars
    expect(screen.getByText("11/280")).toBeInTheDocument();
  });

  it("renders the save button with correct label", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: "Save profile" }),
    ).toBeInTheDocument();
  });

  it("shows no validation errors initially", () => {
    renderForm();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ProfileForm — live avatar preview", () => {
  it("typing a URL into the image field updates the controlled image state (input value changes)", async () => {
    const user = userEvent.setup();
    // Start with no image
    renderForm({ ...defaultInitial, image: "" });

    const imageInput = screen.getByLabelText("Avatar URL");
    await user.type(imageInput, "https://example.com/new.jpg");

    // The controlled input reflects the new value — this proves the state
    // binding is wired up (the same state drives the AvatarImage src prop).
    expect(imageInput).toHaveValue("https://example.com/new.jpg");
  });

  it("clearing the image field falls back to showing AvatarFallback letter", async () => {
    const user = userEvent.setup();
    renderForm();

    const imageInput = screen.getByLabelText("Avatar URL");
    await user.clear(imageInput);

    // When image is empty the AvatarImage receives undefined src; base-ui shows
    // only the AvatarFallback. The fallback letter "A" (first letter of "Alice
    // Smith") must still be in the document.
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

describe("ProfileForm — client-side validation (fetch not called)", () => {
  const mockFetch = () => vi.mocked(fetch);

  it("empty name shows name required error", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, name: "" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name is required.",
    );
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("name over 80 chars shows length error", async () => {
    const user = userEvent.setup();
    const longName = "A".repeat(81);
    renderForm({ ...defaultInitial, name: longName });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name must be 80 characters or fewer.",
    );
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("ftp:// image URL shows image error", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, image: "ftp://bad.example.com/img.jpg" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const imageAlert = alerts.find((a) =>
      a.textContent?.includes("Image must be a valid http(s) URL."),
    );
    expect(imageAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("image URL over 2048 chars shows image error", async () => {
    const user = userEvent.setup();
    const longUrl = "https://example.com/" + "a".repeat(2030);
    renderForm({ ...defaultInitial, image: longUrl });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const imageAlert = alerts.find((a) =>
      a.textContent?.includes("Image must be a valid http(s) URL."),
    );
    expect(imageAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("birthdate 'not-a-date' shows birthdate error", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, birthdate: "not-a-date" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const bdAlert = alerts.find((a) =>
      a.textContent?.includes("Birthdate must be a real date in the past."),
    );
    expect(bdAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("birthdate before 1900 shows birthdate error", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, birthdate: "1899-12-31" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const bdAlert = alerts.find((a) =>
      a.textContent?.includes("Birthdate must be a real date in the past."),
    );
    expect(bdAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("future birthdate shows birthdate error", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, birthdate: "2099-01-01" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const bdAlert = alerts.find((a) =>
      a.textContent?.includes("Birthdate must be a real date in the past."),
    );
    expect(bdAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("bio over 280 chars shows bio error and counter with destructive class", async () => {
    const user = userEvent.setup();
    renderForm();

    const textarea = screen.getByLabelText("Bio");
    // bypass maxLength by using fireEvent.change directly
    const longBio = "B".repeat(281);
    fireEvent.change(textarea, { target: { value: longBio } });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const bioAlert = alerts.find((a) =>
      a.textContent?.includes("Bio must be 280 characters or fewer."),
    );
    expect(bioAlert).toBeInTheDocument();

    // Counter should show destructive class when >= 280
    const counter = screen.getByText("281/280");
    expect(counter).toHaveClass("text-destructive");

    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("location over 120 chars shows location error", async () => {
    const user = userEvent.setup();
    const longLocation = "L".repeat(121);
    renderForm({ ...defaultInitial, location: longLocation });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    const locAlert = alerts.find((a) =>
      a.textContent?.includes("Location must be 120 characters or fewer."),
    );
    expect(locAlert).toBeInTheDocument();
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("multiple errors shown at once", async () => {
    const user = userEvent.setup();
    renderForm({
      name: "",
      image: "ftp://bad",
      birthdate: "1899-01-01",
      bio: "",
      location: "L".repeat(121),
    });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("errors clear on a subsequent valid submit", async () => {
    const user = userEvent.setup();
    renderForm({ ...defaultInitial, name: "" });

    // First submit: triggers error
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByRole("alert");

    // Fix the name
    await user.type(screen.getByLabelText(/^Name/), "Alice");

    // Mock a successful fetch for the second submit
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "Alice",
          image: defaultInitial.image,
          birthdate: defaultInitial.birthdate,
          bio: defaultInitial.bio,
          location: defaultInitial.location,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});

describe("ProfileForm — pending state", () => {
  it("disables submit and shows saving label while fetch is unresolved, then re-enables", async () => {
    const user = userEvent.setup();

    let resolve: (value: Response) => void;
    const deferred = new Promise<Response>((res) => {
      resolve = res;
    });
    vi.mocked(fetch).mockReturnValue(deferred);

    renderForm();

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const btn = screen.getByRole("button", { name: "Saving…" });
    expect(btn).toBeDisabled();

    resolve!(
      new Response(
        JSON.stringify({
          name: "Alice Smith",
          image: defaultInitial.image,
          birthdate: defaultInitial.birthdate,
          bio: defaultInitial.bio,
          location: defaultInitial.location,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save profile" }),
      ).not.toBeDisabled(),
    );
  });
});

describe("ProfileForm — 200 success", () => {
  it("calls PUT /api/profile with JSON content-type and correct body", async () => {
    const user = userEvent.setup();
    const responseBody = {
      name: "Alice Smith",
      image: "https://example.com/alice.jpg",
      birthdate: "1990-06-15",
      bio: "Hello world",
      location: "New York, US",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      name: "Alice Smith",
      image: "https://example.com/alice.jpg",
      birthdate: "1990-06-15",
      bio: "Hello world",
      location: "New York, US",
    });
  });

  it("shows success toast and calls router.refresh on 200", async () => {
    const user = userEvent.setup();
    const responseBody = {
      name: "Alice Smith",
      image: "https://example.com/alice.jpg",
      birthdate: "1990-06-15",
      bio: "Hello world",
      location: "New York, US",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Profile saved."),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("re-syncs fields from the 200 response body", async () => {
    const user = userEvent.setup();
    const serverResponse = {
      name: "Alice S.",
      image: "https://example.com/updated.jpg",
      birthdate: "1990-06-20",
      bio: "Updated bio",
      location: "Brooklyn, US",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(serverResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(vi.mocked(toast.success)).toHaveBeenCalled());

    expect(screen.getByLabelText(/^Name/)).toHaveValue("Alice S.");
    expect(screen.getByLabelText("Avatar URL")).toHaveValue(
      "https://example.com/updated.jpg",
    );
    expect(screen.getByLabelText("Birthdate")).toHaveValue("1990-06-20");
    expect(screen.getByLabelText("Bio")).toHaveValue("Updated bio");
    expect(screen.getByLabelText("Location")).toHaveValue("Brooklyn, US");
  });
});

describe("ProfileForm — 400 server errors", () => {
  it("shows inline server errors and does NOT call router.refresh", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ errors: { name: "Name already taken." } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Name already taken.");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("_body and _auth keys in 400 errors show as toasts, not inline", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: {
            _body: "Invalid request body.",
            _auth: "Unauthorized action.",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Invalid request body.",
      ),
    );
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Unauthorized action.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProfileForm — 401", () => {
  it("redirects to / on 401", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProfileForm — network/non-2xx errors", () => {
  it("fetch rejection shows error toast and re-enables button", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Network error. Please check your connection.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Save profile" }),
    ).not.toBeDisabled();
  });

  it("non-2xx non-400/401 response shows generic error toast and re-enables", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Save profile" }),
    ).not.toBeDisabled();
  });
});
