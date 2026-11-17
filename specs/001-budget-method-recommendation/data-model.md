# Data Model: Финансовый профиль и рекомендация метода бюджетирования

**Feature**: `001-budget-method-recommendation` | **Date**: 2026-11-17

Все суммы — `Money`. Доли — в базисных пунктах (б.п., 10 000 = 100 %). Даты — ISO 8601 в UTC.
Идентификаторы — UUID v4, генерируются на устройстве.

## Money

| Поле | Тип | Правила |
|---|---|---|
| `amount` | integer | Копейки. `Number.isSafeInteger`, ≥ 0, если не указано иное |
| `currency` | `"RUB"` | ISO 4217. В v1 только RUB; тип — строковый литерал-союз, расширяемый |

Операции над `Money` с разной валютой бросают ошибку (принцип I).

## FinancialProfile (снимок анкеты)

| Поле | Тип | Обязательно | Правила |
|---|---|---|---|
| `id` | uuid | да | Новый id на каждую сохранённую версию |
| `createdAt` | datetime | да | |
| `currency` | `"RUB"` | да | Все суммы профиля в этой валюте |
| `incomeType` | `fixed` \| `freelance` \| `mixed` \| `seasonal` | да | |
| `monthlyIncome` | Money | да | > 0. Для нефиксированного дохода — средний месяц |
| `incomeMin` | Money | если `incomeType ≠ fixed` | > 0 и ≤ `monthlyIncome` (основа плана, делим на неё) |
| `incomeMax` | Money | если `incomeType ≠ fixed` | ≥ `monthlyIncome` |
| `mandatoryExpenses` | Money | да | Жильё, коммунальные, связь, лекарства и т. п. |
| `debtPayments` | Money | да | Ежемесячные платежи по долгам, ≥ 0 |
| `debtTotal` | Money | да | Остаток долга, ≥ 0; если `debtPayments > 0`, то `> 0` |
| `dependents` | integer | да | 0–20 |
| `savings` | Money | да | ≥ 0 |
| `goal` | `emergency_fund` \| `big_purchase` \| `debt_payoff` \| `spending_control` | да | |
| `controlLevel` | `simple` \| `detailed` | да | |

Анкета — 11 вопросов в 4 шагах (FR-001): доход → обязательные траты и долги → семья и
сбережения → цель и контроль. Ограничение «неправдоподобных значений»:
`mandatoryExpenses + debtPayments ≤ 100 × monthlyIncome`.

### QuestionnaireDraft

Частично заполненная анкета (FR-004): те же поля, все необязательные, плюс `step` (1–4) и
`updatedAt`. Удаляется после сохранения полного профиля.

## ProfileMetrics (вычисляется, не вводится)

| Поле | Формула | Тип |
|---|---|---|
| `baseIncome` | `fixed` → `monthlyIncome`; иначе → `incomeMin` | Money |
| `stabilityBp` | `fixed` → 10 000; иначе `floor(incomeMin × 10 000 / monthlyIncome)` | integer |
| `isIrregular` | `incomeType ≠ fixed` и `stabilityBp < 7 000` | boolean |
| `obligations` | `mandatoryExpenses + debtPayments` | Money |
| `mandatoryShareBp` | `floor(obligations × 10 000 / baseIncome)` | integer |
| `debtLoadBp` | `floor(debtPayments × 10 000 / baseIncome)` | integer |
| `savingsMonthsX10` | `floor(savings × 10 / obligations)`; при `obligations = 0` → 120 | integer |
| `isDeficit` | `obligations ≥ baseIncome` | boolean |

Edge case «очень нестабильный доход» (spec): при `incomeMin < 30 %` среднего базой всё равно
служит `incomeMin` — это уже покрыто формулой `baseIncome`.

## BudgetMethod (каталог, статичные данные в коде)

| Поле | Тип |
|---|---|
| `id` | `rule_50_30_20` \| `rule_70_20_10` \| `pay_yourself_first` \| `weekly_limits` \| `envelopes` \| `base_plus_buffer` |
| `order` | integer — порядок в каталоге, используется для разрешения ничьих |
| `titleKey`, `descriptionKey` | ключи строк в `i18n/ru.ts` |
| `parts` | список частей бюджета с долями в б.п. (см. [contracts/scoring-rules-v1.md](contracts/scoring-rules-v1.md)) |
| `minSavingsBp` | минимум накоплений метода |
| `hasWeeklyLimits` | boolean |

## ScoringRuleSet

| Поле | Тип |
|---|---|
| `version` | semver, в v1 — `"1.0.0"` |
| `rules` | список `{ id, condition, points: Partial<Record<MethodId, number>>, explanationKey }` |

Правила v1 — в [contracts/scoring-rules-v1.md](contracts/scoring-rules-v1.md).

## Recommendation

| Поле | Тип | Правила |
|---|---|---|
| `id` | uuid | |
| `createdAt` | datetime | |
| `profileId` | uuid | Ссылка на снимок `FinancialProfile` |
| `rulesVersion` | semver | FR-010 |
| `mode` | `normal` \| `deficit` | `deficit`, если `metrics.isDeficit` (FR-012) |
| `scores` | `Record<MethodId, number>` | Пусто в режиме `deficit` |
| `recommendedMethodId` | MethodId \| null | null в режиме `deficit` |
| `alternativeMethodId` | MethodId \| null | Второй по баллам |
| `factors` | 1–4 × `{ ruleId, points, explanationKey, params }` | Правила с наибольшим вкладом в рекомендованный метод |
| `deficit` | Money \| null | `obligations − baseIncome` в режиме `deficit` |
| `decision` | `pending` \| `accepted` \| `overridden` | |
| `chosenMethodId` | MethodId \| null | При `accepted` = рекомендованный; при `overridden` — выбранный пользователем |
| `decidedAt` | datetime \| null | |

**Переходы состояния `decision`**: `pending → accepted` (принял) или `pending → overridden`
(выбрал другой метод). Из `accepted` возможен переход в `overridden`, если пользователь позже
сменил метод. Итоговые состояния не откатываются в `pending`.

## BudgetPlan

| Поле | Тип | Правила |
|---|---|---|
| `id` | uuid | |
| `recommendationId` | uuid | |
| `methodId` | MethodId | |
| `period` | `{ year, month }` | Календарный месяц |
| `income` | Money | = `metrics.baseIncome` |
| `parts` | список `PlanPart` | Σ `amount` = `income` ровно (FR-015) |
| `weeklyLimits` | список `{ weekIndex, from, to, days, limit: Money }` \| null | Только для методов с недельными лимитами |
| `surplusRule` | `{ bufferBp, savingsBp, freeBp, bufferTarget: Money }` \| null | Только для `base_plus_buffer` (FR-017) |
| `warnings` | список кодов | Например, `SAVINGS_BELOW_MIN`, `OBLIGATIONS_EXCEED_NEEDS` |
| `createdAt`, `updatedAt` | datetime | |

### PlanPart

| Поле | Тип |
|---|---|
| `key` | `needs` \| `wants` \| `savings` \| `living` \| `debt_or_giving` \| `free` \| `obligations` \| `flexible` \| `food` \| `transport` \| `leisure` \| `other` |
| `amount` | Money |
| `isManual` | boolean — сумма задана пользователем вручную (FR-016) |
| `isFixed` | boolean — часть равна фактическим обязательствам и не перераспределяется |

**Ручная корректировка (FR-016)**: пользователь меняет `amount` одной части → она помечается
`isManual`. Разница распределяется по частям без `isManual` и без `isFixed` пропорционально их
текущим суммам; остаток округления — в `savings` (или в `free`, если её нет). Если сумма
ручных частей больше дохода, изменение отклоняется. Если накопления опустились ниже
`minSavingsBp`, добавляется предупреждение `SAVINGS_BELOW_MIN`.

## AppState (единица хранения)

| Поле | Тип |
|---|---|
| `schemaVersion` | integer, в v1 — `1` |
| `profiles` | список `FinancialProfile` (история версий, последняя — текущая) |
| `draft` | `QuestionnaireDraft` \| null |
| `recommendations` | список `Recommendation` |
| `plans` | список `BudgetPlan` |
| `activePlanId` | uuid \| null |
| `localStorageNoticeAcknowledgedAt` | datetime \| null — FR-020a |

`AppState` сериализуется в JSON, шифруется и сохраняется целиком одной записью
(см. [contracts/storage.md](contracts/storage.md)). При изменении `schemaVersion` выполняется
миграция при чтении.
