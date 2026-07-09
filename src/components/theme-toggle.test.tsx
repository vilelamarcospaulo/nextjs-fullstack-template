import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

// vi.fn()'s default (untyped) Mock shape doesn't structurally satisfy
// next-themes' real setTheme signature (Dispatch<SetStateAction<string>>)
// under strict mode — this mock only needs to be callable with a string, so
// route through `unknown` once here rather than casting at every call site.
function mockUseThemeReturn(
  resolvedTheme: string | undefined,
  setTheme: ReturnType<typeof vi.fn>,
): ReturnType<typeof useTheme> {
  return { resolvedTheme, setTheme } as unknown as ReturnType<typeof useTheme>;
}

describe("ThemeToggle", () => {
  let mockSetTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetTheme = vi.fn();
  });

  it("button has accessible name 'Toggle theme'", () => {
    vi.mocked(useTheme).mockReturnValue(
      mockUseThemeReturn("light", mockSetTheme),
    );
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Toggle theme" }),
    ).toBeInTheDocument();
  });

  it("is not disabled", () => {
    vi.mocked(useTheme).mockReturnValue(
      mockUseThemeReturn("light", mockSetTheme),
    );
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Toggle theme" }),
    ).not.toBeDisabled();
  });

  it("clicking when resolvedTheme='light' calls setTheme('dark')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue(
      mockUseThemeReturn("light", mockSetTheme),
    );
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("clicking when resolvedTheme='dark' calls setTheme('light')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue(
      mockUseThemeReturn("dark", mockSetTheme),
    );
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("clicking when resolvedTheme=undefined calls setTheme('dark')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue(
      mockUseThemeReturn(undefined, mockSetTheme),
    );
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
