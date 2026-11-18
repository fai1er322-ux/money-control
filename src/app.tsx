import { useEffect, useState } from "react";
import { decide, type DecisionChoice } from "./domain/history";
import { adjustPart } from "./domain/methods/adjust";
import { buildPlan } from "./domain/methods/build-plan";
import type { MethodId } from "./domain/methods/catalog";
import { computeMetrics, diffMetrics } from "./domain/metrics";
import type { Period } from "./domain/plan";
import { createProfile, profileToAnswers, type DraftAnswers } from "./domain/profile";
import { recommend } from "./domain/scoring/engine";
import { SCORING_RULES_V1 } from "./domain/scoring/rules-v1";
import { emptyAppState, type AppState } from "./storage/app-state";
import { createRepository, type LoadError, type StateRepository } from "./storage/repository";
import type { TelegramWebApp } from "./telegram/webapp";
import { t } from "./ui/i18n/ru";
import { History } from "./ui/screens/History";
import { MethodCatalog } from "./ui/screens/MethodCatalog";
import { Plan } from "./ui/screens/Plan";
import { Questionnaire } from "./ui/screens/Questionnaire";
import { Recommendation, type RecalculationSummary } from "./ui/screens/Recommendation";
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
/** The plan covers the current calendar month on this device. */
const currentPeriod = (): Period => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

type View = "auto" | "catalog" | "recommendation" | "history";

/**
 * Screen router. The screen is derived from the stored state, so a reload resumes where the
 * user left off: notice → questionnaire (while a draft exists) → the active plan of the latest
 * recommendation, or the recommendation itself.
 */
function AppShell() {
  const { state, storageMode, saveError, update } = useAppState();
  const latest = state.recommendations.at(-1) ?? null;
  const latestProfile = state.profiles.at(-1) ?? null;
  const [view, setView] = useState<View>("auto");
  const activePlan = state.plans.find((p) => p.id === state.activePlanId) ?? null;
  const plan =
    activePlan && latest && activePlan.recommendationId === latest.id ? activePlan : null;

  function choose(rec: NonNullable<typeof latest>, choice: DecisionChoice) {
    const methodId = choice.kind === "accept" ? rec.recommendedMethodId : choice.methodId;
    const profile = state.profiles.find((p) => p.id === rec.profileId);
    if (!methodId || !profile) return;
    if (plan && methodId === plan.methodId) {
      setView("auto");
      return;
    }
    const at = now();
    const decided = decide(rec, choice, at);
    const next = buildPlan(profile, methodId, currentPeriod(), {
      now: at,
      newId,
      recommendationId: rec.id,
    });
    update((s) => ({
      ...s,
      recommendations: s.recommendations.map((r) => (r.id === rec.id ? decided : r)),
      plans: [...s.plans, next],
      activePlanId: next.id,
    }));
    setView("auto");
  }

  const saveDraft = (answers: DraftAnswers, step: 1 | 2 | 3 | 4) =>
    update((s) => ({ ...s, draft: { ...answers, step, updatedAt: now() } }));

  /** FR-005: edit the profile at any time, starting from the current answers. */
  const editAnswers = () => {
    setView("auto");
    saveDraft(latestProfile ? profileToAnswers(latestProfile) : {}, 1);
  };

  const recalculation = ((): RecalculationSummary | null => {
    const previous = state.recommendations.at(-2);
    if (!latest || !previous) return null;
    const before = state.profiles.find((p) => p.id === previous.profileId);
    const after = state.profiles.find((p) => p.id === latest.profileId);
    if (!before || !after) return null;
    return {
      previousMethodId: previous.recommendedMethodId,
      metricChanges: diffMetrics(computeMetrics(before), computeMetrics(after)),
      planUpdated: plan !== null && previous.recommendedMethodId === latest.recommendedMethodId,
    };
  })();

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
          let recommendation = recommend(profile, SCORING_RULES_V1, ctx);
          // US3.2: the method stays suitable → keep the user's method and rebuild the plan.
          let rebuilt: ReturnType<typeof buildPlan> | null = null;
          const keepMethod =
            plan &&
            latest &&
            recommendation.mode === "normal" &&
            recommendation.recommendedMethodId === latest.recommendedMethodId;
          if (keepMethod) {
            recommendation = decide(
              recommendation,
              plan.methodId === recommendation.recommendedMethodId
                ? { kind: "accept" }
                : { kind: "override", methodId: plan.methodId },
              ctx.now,
            );
            rebuilt = buildPlan(profile, plan.methodId, currentPeriod(), {
              ...ctx,
              recommendationId: recommendation.id,
            });
          }
          const rec = recommendation;
          update((s) => ({
            ...s,
            profiles: [...s.profiles, profile],
            recommendations: [...s.recommendations, rec],
            plans: rebuilt ? [...s.plans, rebuilt] : s.plans,
            activePlanId: rebuilt ? rebuilt.id : s.activePlanId,
            draft: null,
          }));
          // After an edit, show what changed before going back to the plan.
          setView(latest ? "recommendation" : "auto");
        }}
      />
    );
  } else if (view === "history") {
    screen = <History recommendations={state.recommendations} onBack={() => setView("auto")} />;
  } else if (view === "catalog" && latest.recommendedMethodId) {
    screen = (
      <MethodCatalog
        recommendedMethodId={latest.recommendedMethodId}
        currentMethodId={plan?.methodId ?? null}
        onChoose={(methodId: MethodId) => choose(latest, { kind: "override", methodId })}
        onBack={() => setView("auto")}
      />
    );
  } else if (plan && view !== "recommendation") {
    screen = (
      <Plan
        plan={plan}
        recommendedMethodId={latest.recommendedMethodId}
        overridden={latest.decision === "overridden"}
        onChangeMethod={() => setView("catalog")}
        onShowRecommendation={() => setView("recommendation")}
        onEditAnswers={editAnswers}
        onShowHistory={() => setView("history")}
        onAdjust={(key, amount) => {
          const res = adjustPart(plan, key, amount, now());
          if (res.ok) {
            update((s) => ({
              ...s,
              plans: s.plans.map((p) => (p.id === plan.id ? res.value : p)),
            }));
          }
          return res;
        }}
      />
    );
  } else {
    screen = (
      <Recommendation
        recommendation={latest}
        recalculation={recalculation}
        onEditAnswers={editAnswers}
        onShowHistory={() => setView("history")}
        onAccept={() => choose(latest, { kind: "accept" })}
        onChooseOther={() => setView("catalog")}
        onOpenPlan={plan ? () => setView("auto") : undefined}
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
