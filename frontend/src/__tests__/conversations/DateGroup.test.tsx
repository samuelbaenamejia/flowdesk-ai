import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DateGroup,
  formatDateGroupLabel,
  getDateGroupKey,
} from "@/components/conversations/DateGroup";

const NOW = new Date(2026, 6, 31, 12, 0, 0); // viernes 31 jul 2026

const todayKey = getDateGroupKey(new Date());
const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterdayKey = getDateGroupKey(yesterdayDate);

describe("getDateGroupKey", () => {
  it("returns local YYYY-MM-DD key", () => {
    expect(getDateGroupKey(new Date(2026, 6, 31, 23, 59))).toBe("2026-07-31");
    expect(getDateGroupKey(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });
});

describe("formatDateGroupLabel", () => {
  it("labels today as 'Hoy'", () => {
    expect(formatDateGroupLabel("2026-07-31", NOW)).toBe("Hoy");
  });

  it("labels yesterday as 'Ayer'", () => {
    expect(formatDateGroupLabel("2026-07-30", NOW)).toBe("Ayer");
  });

  it("labels same-week dates with weekday", () => {
    expect(formatDateGroupLabel("2026-07-27", NOW)).toBe("lun 27 jul");
    expect(formatDateGroupLabel("2026-08-02", NOW)).toBe("dom 2 ago");
  });

  it("labels other dates of the current year with day and month", () => {
    expect(formatDateGroupLabel("2026-07-20", NOW)).toBe("20 jul");
  });

  it("labels dates of other years with day, month and year", () => {
    expect(formatDateGroupLabel("2025-12-31", NOW)).toBe("31 dic 2025");
  });
});

describe("DateGroup", () => {
  it("renders the label with aria-expanded true by default", () => {
    render(
      <DateGroup dateKey={todayKey} count={2} collapsed={false} onToggle={vi.fn()}>
        <p>mensaje 1</p>
      </DateGroup>
    );
    expect(screen.getByRole("button", { name: /Hoy/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("mensaje 1")).toBeInTheDocument();
  });

  it("hides children and shows summary when collapsed", () => {
    render(
      <DateGroup dateKey={yesterdayKey} count={12} collapsed onToggle={vi.fn()}>
        <p>mensaje 1</p>
      </DateGroup>
    );
    const button = screen.getByRole("button", { name: /Ayer/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("12 mensajes");
    expect(screen.queryByText("mensaje 1")).not.toBeInTheDocument();
  });

  it("shows singular summary for a single message", () => {
    render(
      <DateGroup dateKey={yesterdayKey} count={1} collapsed onToggle={vi.fn()}>
        <p>mensaje 1</p>
      </DateGroup>
    );
    expect(screen.getByRole("button", { name: /Ayer/ })).toHaveTextContent(
      "1 mensaje"
    );
  });

  it("calls onToggle when the header is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <DateGroup dateKey={todayKey} count={2} collapsed={false} onToggle={onToggle}>
        <p>mensaje 1</p>
      </DateGroup>
    );
    await userEvent.click(screen.getByRole("button", { name: /Hoy/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
