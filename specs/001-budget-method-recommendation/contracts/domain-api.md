# Contract: Публичный API доменного ядра (`src/domain`)

Ядро — чистые функции без IO, времени и случайности: `now` и генератор id передаются явно.
Типы — из [../data-model.md](../data-model.md). Ошибки валидации возвращаются как значения,
а не исключения. Исключение бросается только при нарушении инварианта (например, сложение
разных валют).

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

interface FieldError { field: string; code: string; params?: Record<string, unknown> }

// Анкета
validateProfileInput(input: unknown): Result<FinancialProfileInput, FieldError[]>;
validateDraft(input: unknown): Result<QuestionnaireDraft, FieldError[]>;

// Показатели
computeMetrics(profile: FinancialProfile): ProfileMetrics;

// Скоринг
const SCORING_RULES_V1: ScoringRuleSet;            // version "1.0.0"
recommend(
  profile: FinancialProfile,
  rules: ScoringRuleSet,
  ctx: { now: string; newId: () => string },
): Recommendation;                                  // decision = "pending"

// Решение пользователя
decide(
  rec: Recommendation,
  choice: { kind: "accept" } | { kind: "override"; methodId: MethodId },
  now: string,
): Recommendation;

// Планы
buildPlan(
  profile: FinancialProfile,
  methodId: MethodId,
  period: { year: number; month: number },
  ctx: { now: string; newId: () => string; recommendationId: string },
): BudgetPlan;

adjustPart(
  plan: BudgetPlan,
  partKey: PlanPartKey,
  amount: Money,
  now: string,
): Result<BudgetPlan, "MANUAL_PARTS_EXCEED_INCOME" | "PART_IS_FIXED">;

// Изменение профиля (US3)
diffMetrics(prev: ProfileMetrics, next: ProfileMetrics): MetricChange[];
```

## Гарантии

- `recommend` и `buildPlan` детерминированы: одинаковые аргументы → одинаковый результат.
- Для любого `buildPlan` и `adjustPart`: `Σ parts.amount === income.amount`.
- `weeklyLimits`, если есть: `Σ limit.amount === flexible.amount`.
- `recommend` при `metrics.isDeficit` возвращает `mode: "deficit"` и не вызывает правила.
- Эталонные примеры E1–E6 из [scoring-rules-v1.md](scoring-rules-v1.md) — обязательные тесты.
