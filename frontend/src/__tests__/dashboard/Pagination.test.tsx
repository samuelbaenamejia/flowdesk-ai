import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/dashboard/Pagination";

describe("Pagination", () => {
  it("disables previous button at offset 0", () => {
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={true}
        loading={false}
        count={5}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  });

  it("disables next button when hasMore is false", () => {
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={false}
        loading={false}
        count={5}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
  });

  it("enables both buttons with data", () => {
    render(
      <Pagination
        offset={20}
        limit={20}
        hasMore={true}
        loading={false}
        count={20}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Página anterior" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Página siguiente" })).not.toBeDisabled();
  });

  it("disables both buttons while loading", () => {
    render(
      <Pagination
        offset={20}
        limit={20}
        hasMore={true}
        loading={true}
        count={20}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
  });

  it("calls onPrevious when clicking previous", async () => {
    const onPrevious = vi.fn();
    render(
      <Pagination
        offset={20}
        limit={20}
        hasMore={true}
        loading={false}
        count={20}
        onPrevious={onPrevious}
        onNext={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when clicking next", async () => {
    const onNext = vi.fn();
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={true}
        loading={false}
        count={20}
        onPrevious={() => {}}
        onNext={onNext}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("shows range indicator", () => {
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={true}
        loading={false}
        count={20}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByText("1 – 20")).toBeInTheDocument();
  });

  it("shows range indicator with total", () => {
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={true}
        loading={false}
        count={20}
        total={42}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByText("1 – 20 de 42")).toBeInTheDocument();
  });

  it("has accessible labels on buttons", () => {
    render(
      <Pagination
        offset={0}
        limit={20}
        hasMore={true}
        loading={false}
        count={5}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    );
    expect(screen.getByLabelText("Página anterior")).toBeInTheDocument();
    expect(screen.getByLabelText("Página siguiente")).toBeInTheDocument();
  });
});
