import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));

describe("ThemeToggle", () => {
  let mockSetTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetTheme = vi.fn();
  });

  it("button has accessible name 'Toggle theme'", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Toggle theme" }),
    ).toBeInTheDocument();
  });

  it("is not disabled", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Toggle theme" }),
    ).not.toBeDisabled();
  });

  it("clicking when resolvedTheme='light' calls setTheme('dark')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("clicking when resolvedTheme='dark' calls setTheme('light')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("clicking when resolvedTheme=undefined calls setTheme('dark')", async () => {
    const user = userEvent.setup();
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: undefined,
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
