import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/components/layout/Header";

const mockLogout = vi.fn();
const mockPush = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Header", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: "test@flowdesk.ai" },
      logout: mockLogout,
    });
  });

  it("renders dashboard label", () => {
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders user email", () => {
    render(<Header />);
    expect(screen.getByText("test@flowdesk.ai")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<Header />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("calls logout and redirects on click", async () => {
    render(<Header />);
    await userEvent.click(screen.getByText("Logout"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("does not render email when user has no email", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "" },
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.queryByText("test@flowdesk.ai")).not.toBeInTheDocument();
  });

  it("renders without crashing when user is null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
