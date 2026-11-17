# Contract: Правила скоринга и каталог методов, версия 1.0.0

Это нормативный контракт: эталонные тесты (принцип IV) пишутся по примерам из этого файла.
Изменение любого числа здесь — новая версия правил (MINOR для новых правил, PATCH для
изменения баллов или порогов, MAJOR для смены формул показателей).

Показатели профиля (`stabilityBp`, `mandatoryShareBp` и т. д.) определены в
[../data-model.md](../data-model.md#profilemetrics-вычисляется-не-вводится).

## 1. Режим дефицита

Если `isDeficit`, скоринг не выполняется. `mode = deficit`, `deficit = obligations − baseIncome`.

## 2. Каталог методов (порядок = приоритет при равенстве баллов)

| order | id | Части плана (б.п. от дохода) | minSavingsBp | Недельные лимиты |
|---|---|---|---|---|
| 1 | `rule_50_30_20` | needs 5000, wants 3000, savings 2000 | 1000 | нет |
| 2 | `rule_70_20_10` | living 7000, savings 2000, debt_or_giving 1000 | 1000 | нет |
| 3 | `pay_yourself_first` | savings 2000 (первой), free 8000 | 1000 | нет |
| 4 | `weekly_limits` | obligations = факт (`isFixed`), savings 1000, flexible = остаток | 500 | да, из `flexible` |
| 5 | `envelopes` | obligations = факт (`isFixed`), savings 1000, остаток → food 4000, transport 2000, leisure 2000, other 2000 (б.п. от остатка) | 500 | нет |
| 6 | `base_plus_buffer` | от `baseIncome`: obligations = факт (`isFixed`), savings 1000, flexible = остаток | 500 | нет |

Правила расчёта сумм:

- Каждая часть = `floor(база × доля / 10 000)`. Остаток округления добавляется в `savings`.
- Для `weekly_limits`, `envelopes` и `base_plus_buffer`: если после `obligations` и `savings`
  остаток отрицательный, `savings` уменьшается до нуля, добавляется предупреждение
  `SAVINGS_BELOW_MIN`.
- Для `rule_50_30_20`: если `obligations > needs`, добавляется предупреждение
  `OBLIGATIONS_EXCEED_NEEDS`. Для `rule_70_20_10` — то же относительно `living`.
- **Недельные лимиты**: недели начинаются с понедельника и обрезаются границами месяца.
  Лимит недели = `floor(flexible × дней_в_неделе / дней_в_месяце)`. Остаток округления —
  в последнюю неделю.
- **`base_plus_buffer`, доход сверх базы** (`surplusRule`): 5000 б.п. в буферный фонд, 3000 —
  в накопления, 2000 — свободно, пока буферный фонд меньше `bufferTarget = 3 × obligations`.
  После этого доля буфера переходит в накопления.

## 3. Правила

Баллы суммируются по всем сработавшим правилам. Рекомендация — метод с наибольшей суммой;
при равенстве — меньший `order`. Альтернатива — следующий по тому же порядку.

| id | Условие | Баллы |
|---|---|---|
| `R1_irregular_income` | `isIrregular` | base_plus_buffer +50 |
| `R2_stable_income` | `stabilityBp ≥ 9000` | rule_50_30_20 +10, pay_yourself_first +10 |
| `R3_low_obligations` | `mandatoryShareBp ≤ 5000` | rule_50_30_20 +30 |
| `R4_mid_obligations` | `5000 < mandatoryShareBp ≤ 7000` | rule_70_20_10 +30 |
| `R5_high_obligations` | `mandatoryShareBp > 7000` | weekly_limits +30, envelopes +30 |
| `R6_high_debt` | `debtLoadBp ≥ 3000` | envelopes +35, weekly_limits +15 |
| `R7_control_detailed` | `controlLevel = detailed` | envelopes +15, weekly_limits +5 |
| `R8_control_simple` | `controlLevel = simple` | pay_yourself_first +15, rule_50_30_20 +10, rule_70_20_10 +10 |
| `R9_goal_emergency_low_savings` | `goal = emergency_fund` и `savingsMonthsX10 < 30` | pay_yourself_first +15, rule_50_30_20 +10 |
| `R10_goal_big_purchase` | `goal = big_purchase` | pay_yourself_first +15 |
| `R11_goal_debt_payoff` | `goal = debt_payoff` | envelopes +10, rule_70_20_10 +5 |
| `R12_goal_spending_control` | `goal = spending_control` | weekly_limits +15 |
| `R13_dependents_low_savings` | `dependents ≥ 1` и `savingsMonthsX10 < 30` | pay_yourself_first +10, rule_50_30_20 +5 |

**Факторы объяснения**: правила, давшие баллы рекомендованному методу, по убыванию баллов
(при равенстве — по порядку в таблице), не больше 4.

## 4. Эталонные примеры

Суммы указаны в рублях для читаемости; в фикстурах — в копейках.

### E1 — стабильная зарплата (spec US1, сценарий 1)

Профиль: `fixed`, доход 120 000, обязательные 45 000, долги 0, иждивенцы 0, сбережения 0,
цель `emergency_fund`, контроль `simple`.

Показатели: stability 10000, share 3750, debtLoad 0, savingsMonthsX10 0.

| Метод | Баллы |
|---|---|
| rule_50_30_20 | R2 10 + R3 30 + R8 10 + R9 10 = **60** |
| pay_yourself_first | R2 10 + R8 15 + R9 15 = 40 |
| rule_70_20_10 | R8 10 = 10 |

Итог: **rule_50_30_20**, альтернатива pay_yourself_first. Факторы: R3, R2, R8, R9.
План: needs 60 000, wants 36 000, savings 24 000.

### E2 — фрилансер (spec US1, сценарий 2)

Профиль: `freelance`, средний доход 90 000, min 40 000, max 150 000, обязательные 30 000,
долги 0, иждивенцы 0, сбережения 50 000, цель `spending_control`, контроль `simple`.

Показатели: stability 4444 (irregular), baseIncome 40 000, share 7500, savingsMonthsX10 16.

| Метод | Баллы |
|---|---|
| base_plus_buffer | R1 50 = **50** |
| weekly_limits | R5 30 + R12 15 = 45 |
| envelopes | R5 30 = 30 |

Итог: **base_plus_buffer**, альтернатива weekly_limits. Факторы: R1.
План от 40 000: obligations 30 000, savings 4 000, flexible 6 000; bufferTarget 90 000.

### E3 — высокая долговая нагрузка (spec US1, сценарий 3)

Профиль: `fixed`, доход 100 000, обязательные 50 000, платежи по долгам 30 000, долг 600 000,
иждивенцы 1, сбережения 0, цель `debt_payoff`, контроль `detailed`.

Показатели: share 8000, debtLoad 3000, savingsMonthsX10 0.

| Метод | Баллы |
|---|---|
| envelopes | R5 30 + R6 35 + R7 15 + R11 10 = **90** |
| weekly_limits | R5 30 + R6 15 + R7 5 = 50 |
| pay_yourself_first | R2 10 + R13 10 = 20 |

Итог: **envelopes**, альтернатива weekly_limits. Факторы: R6 (долговая нагрузка — главная
причина), R5, R7, R11.

### E4 — дефицит

Профиль: `fixed`, доход 50 000, обязательные 45 000, платежи по долгам 10 000.
Итог: `mode = deficit`, deficit 5 000, рекомендации нет.

### E5 — недельные лимиты (spec US2, сценарий 2)

Доход 100 000, обязательные 50 000, долги 0, метод weekly_limits, период 2026-12.
Части: obligations 50 000, savings 10 000, flexible 40 000.
Недели декабря 2026 (1 декабря — вторник): 1–6 (6 дн.), 7–13, 14–20, 21–27 (по 7 дн.),
28–31 (4 дн.). Лимиты в копейках: 774 193; 903 225; 903 225; 903 225; 516 132 (остаток 3 коп.
добавлен в последнюю неделю). Сумма = 4 000 000 коп.

### E6 — округление

Метод rule_50_30_20, доход 100 001,01 ₽ (10 000 101 коп.).
needs 5 000 050, wants 3 000 030, savings 2 000 020 + остаток 1 = 2 000 021. Сумма = 10 000 101.
