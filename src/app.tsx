import { useEffect, useState } from "react";
import { createProfile, profileToAnswers, type DraftAnswers } from "./domain/profile";
import { recommend } from "./domain/scoring/engine";
import { SCORING_RULES_V1 } from "./domain/scoring/rules-v1";
import { emptyAppState, type AppState } from "./storage/app-state";
import { createRepository, type LoadError, type StateRepository } from "./storage/repository";
import type { TelegramWebApp } from "./telegram/webapp";
import { t } from "./ui/i18n/ru";
import { Questionnaire } from "./ui/screens/Questionnaire";
import { Recommendation } from "./ui/screens/Recommendation";
import { StorageError } from "./ui/screens/StorageError";
import { Welcome } from "./ui/screens/Welcome";
import { AppStateProvider, useAppState } from "./ui/state";
import { TelegramProvider } from "./ui/telegram";

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
    <TelegramProvider value={webApp}>
      <AppStateProvider repository={boot.repository} initial={boot.state}>
        <AppShell />
      </AppStateProvider>
    </TelegramProvider>
  );
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

/**
 * Screen router. The screen is derived from the stored state, so a reload resumes where the
 * user left off: notice → questionnaire (while a draft exists) → latest recommendation.
 */
function AppShell() {
  const { state, storageMode, saveError, update } = useAppState();
  const latest = state.recommendations.at(-1) ?? null;
  const latestProfile = state.profiles.at(-1) ?? null;

  const saveDraft = (answers: DraftAnswers, step: 1 | 2 | 3 | 4) =>
    update((s) => ({ ...s, draft: { ...answers, step, updatedAt: now() } }));

  let screen;
  if (!state.localStorageNoticeAcknowledgedAt) {
    screen = (
      <Welcome
        storageMode={storageMode}
        onStart={() =>
          update((s) => ({
            ...s,
            localStorageNoticeAcknowledgedAt: now(),
            draft: s.draft ?? { step: 1, updatedAt: now() },
          }))
        }
      />
    );
  } else if (state.draft || !latest) {
    const { step = 1, updatedAt: _updatedAt, ...answers } = state.draft ?? {};
    screen = (
      <Questionnaire
        initialAnswers={answers}
        initialStep={step}
        onDraftChange={saveDraft}
        onCancel={latest ? () => update((s) => ({ ...s, draft: null })) : undefined}
        onComplete={(input) => {
          const ctx = { now: now(), newId };
          const profile = createProfile(input, ctx);
          const recommendation = recommend(profile, SCORING_RULES_V1, ctx);
          update((s) => ({
            ...s,
            profiles: [...s.profiles, profile],
            recommendations: [...s.recommendations, recommendation],
            draft: null,
          }));
        }}
      />
    );
  } else {
    screen = (
      <Recommendation
        recommendation={latest}
        onEditAnswers={() => saveDraft(latestProfile ? profileToAnswers(latestProfile) : {}, 1)}
      />
    );
  }

  return (
    <>
      {saveError && (
        <p className="banner-error" role="alert">
          {t(`storage.saveError.${saveError}`)}
        </p>
      )}
      {screen}
    </>
  );
}
