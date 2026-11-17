import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/app";
import type { Money } from "../../src/domain/money";
import { emptyAppState } from "../../src/storage/app-state";
import type { LoadError, StateRepository } from "../../src/storage/repository";
import { MoneyInput } from "../../src/ui/components/MoneyInput";

function fakeRepo(load: Awaited<ReturnType<StateRepository["load"]>>): StateRepository {
  return {
    mode: "indexeddb",
    load: vi.fn(async () => load),
    save: vi.fn(async () => ({ ok: true as const, value: undefined })),
    wipe: vi.fn(async () => undefined),
  };
}

describe("App boot", () => {
  it("shows the home screen with the storage mode after loading", async () => {
    const repo = fakeRepo({ ok: true, value: emptyAppState() });
    render(<App webApp={null} createRepo={async () => repo} />);
    expect(screen.getByText("Загружаем ваши данные…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Money Control" })).toBeInTheDocument();
    expect(screen.getByText(/браузер на этом устройстве/)).toBeInTheDocument();
  });

  it.each<LoadError>(["KEY_MISSING", "DECRYPT_FAILED", "SCHEMA_INVALID"])(
    "offers a confirmed start-over for %s",
    async (error) => {
      const user = userEvent.setup();
      const repo = fakeRepo({ ok: false, error });
      render(<App webApp={null} createRepo={async () => repo} />);
      await user.click(await screen.findByRole("button", { name: "Начать заново" }));
      expect(repo.wipe).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Подтвердить" }));
      expect(repo.wipe).toHaveBeenCalledOnce();
      expect(await screen.findByRole("heading", { name: "Money Control" })).toBeInTheDocument();
    },
  );

  it.each<LoadError>(["MODE_UNAVAILABLE", "KEY_RESTORE_DECLINED", "STORAGE_UNAVAILABLE"])(
    "does not offer to delete data for %s",
    async (error) => {
      render(<App webApp={null} createRepo={async () => fakeRepo({ ok: false, error })} />);
      expect(
        await screen.findByRole("heading", { name: "Не удалось открыть ваши данные" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Начать заново" })).toBeNull();
    },
  );
});

describe("MoneyInput", () => {
  function Harness({ onValue }: { onValue: (m: Money | null) => void }) {
    const [value, setValue] = useState<Money | null>(null);
    return (
      <MoneyInput
        label="Доход в месяц"
        hint="После налогов"
        value={value}
        onChange={(m) => {
          setValue(m);
          onValue(m);
        }}
      />
    );
  }

  it("emits kopecks and links hint and error to the input", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText("Доход в месяц");
    expect(input).toHaveAccessibleDescription("После налогов");

    await user.type(input, "1 234,56");
    expect(onValue).toHaveBeenLastCalledWith({ amount: 123_456, currency: "RUB" });

    await user.clear(input);
    await user.type(input, "-5");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Сумма не может быть отрицательной/);
  });
});
