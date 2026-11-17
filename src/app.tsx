import { useEffect, useState } from "react";
import { emptyAppState, type AppState } from "./storage/app-state";
import { createRepository, type LoadError, type StateRepository } from "./storage/repository";
import type { TelegramWebApp } from "./telegram/webapp";
import { StepLayout } from "./ui/components/StepLayout";
import { t } from "./ui/i18n/ru";
import { StorageError } from "./ui/screens/StorageError";
import { AppStateProvider, useAppState } from "./ui/state";

type Boot =
  | { status: "loading" }
  | { status: "error"; error: LoadError; repository: StateRepository }
  | { status: "ready"; repository: StateRepository; state: AppState };

export interface AppProps {
  webApp: TelegramWebApp | null;
  /** Injectable for tests. */
  createRepo?: (webApp: TelegramWebApp | null) => Promise<StateRepository>;
}

export function App({ webApp, createRepo = createRepository }: AppProps) {
  const [boot, setBoot] = useState<Boot>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    webApp?.ready();
    webApp?.expand();
    const unbindTheme = webApp?.bindTheme();
    (async () => {
      const repository = await createRepo(webApp);
      const loaded = await repository.load();
      if (cancelled) return;
      setBoot(
        loaded.ok
          ? { status: "ready", repository, state: loaded.value ?? emptyAppState() }
          : { status: "error", error: loaded.error, repository },
      );
    })();
    return () => {
      cancelled = true;
      unbindTheme?.();
    };
  }, [webApp, createRepo]);

  if (boot.status === "loading") {
    return (
      <main className="screen" aria-busy="true">
        <p>{t("app.loading")}</p>
      </main>
    );
  }

  if (boot.status === "error") {
    return (
      <StorageError
        error={boot.error}
        onStartOver={async () => {
          await boot.repository.wipe();
          setBoot({ status: "ready", repository: boot.repository, state: emptyAppState() });
        }}
      />
    );
  }

  return (
    <AppStateProvider repository={boot.repository} initial={boot.state}>
      <AppShell />
    </AppStateProvider>
  );
}

/** Screen router. US1–US3 add screens here (Welcome, Questionnaire, Recommendation, …). */
type ScreenName = "home";

function AppShell() {
  const { storageMode, saveError } = useAppState();
  const [screen] = useState<ScreenName>("home");

  return (
    <>
      {saveError && (
        <p className="banner-error" role="alert">
          {t(`storage.saveError.${saveError}`)}
        </p>
      )}
      {screen === "home" && (
        <StepLayout title={t("app.title")}>
          <p>{t("home.placeholder")}</p>
          <p className="field-hint">
            {t("home.storageMode", { mode: t(`storage.mode.${storageMode}`) })}
          </p>
        </StepLayout>
      )}
    </>
  );
}
