---
description: "Task list for 001-budget-method-recommendation"
---

# Tasks: Финансовый профиль и рекомендация метода бюджетирования

**Input**: Design documents from `specs/001-budget-method-recommendation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: обязательны — конституция, принцип IV (Test-First, NON-NEGOTIABLE). Задачи с тестами
в каждой фазе выполняются первыми, и тесты MUST падать до реализации.

**Organization**: задачи сгруппированы по пользовательским историям, чтобы каждую можно было
реализовать и проверить отдельно.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: история из spec.md (US1, US2, US3)
- Пути — от корня репозитория, структура из [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: инициализация проекта и инструментов

- [ ] T001 Создать Vite-проект React 19 + TypeScript в корне репозитория: `package.json` (name `money-control`, `"type": "module"`, Node 22), `index.html` с подключением `https://telegram.org/js/telegram-web-app.js` до бандла, `src/main.tsx`, `src/app.tsx`, `vite.config.ts`
- [ ] T002 Настроить TypeScript strict в `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, target ES2022) и добавить скрипт `typecheck` (`tsc --noEmit`) в `package.json`
- [ ] T003 [P] Настроить ESLint (flat config) и Prettier в `eslint.config.js` и `.prettierrc`; правило `no-console` = error для `src/domain/**` и `src/storage/**` (принцип II: никаких сумм в логах); скрипт `lint`
- [ ] T004 [P] Настроить Vitest + jsdom + Testing Library в `vitest.config.ts` и `tests/setup.ts`; скрипт `test`
- [ ] T005 [P] Настроить Playwright в `playwright.config.ts` (проекты Chromium mobile 375×812 и desktop 1280×800, webServer — `vite preview`); скрипт `test:e2e`
- [ ] T006 [P] Создать каталоги из plan.md: `src/domain/methods/`, `src/domain/scoring/`, `src/storage/`, `src/telegram/`, `src/ui/screens/`, `src/ui/components/`, `src/ui/i18n/`, `tests/fixtures/profiles/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`
- [ ] T007 [P] Добавить в `.gitignore` `node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: деньги, Telegram-обёртка, зашифрованное хранилище и каркас UI — всё, без чего не
работает ни одна история

**⚠️ CRITICAL**: работа над историями начинается только после завершения этой фазы

### Tests for Foundational ⚠️

- [ ] T008 [P] Тесты `Money` в `tests/unit/money.spec.ts`: «Операции над `Money` с разной валютой бросают ошибку»; `amount` — «Копейки. `Number.isSafeInteger`»; `allocateBp(total, shares)` даёт `floor(база × доля / 10 000)` и возвращает остаток округления отдельно (контракт scoring-rules-v1 §2)
- [ ] T009 [P] Тесты шифрования в `tests/unit/crypto.spec.ts`: AES-GCM 256, «новый IV на каждую запись», расшифровка изменённого шифртекста возвращает `DECRYPT_FAILED`
- [ ] T010 [P] Мок `window.Telegram.WebApp` в `tests/mocks/telegram.ts`: `isVersionAtLeast`, `DeviceStorage` и `SecureStorage` в памяти с сигнатурами колбэков из research.md R2 (`getItem` для SecureStorage возвращает третьим аргументом флаг восстановимости), `restoreItem`, `downloadFile`, `MainButton`, `BackButton`, `themeParams`
- [ ] T011 Интеграционные тесты репозитория в `tests/integration/repository.spec.ts` (зависит от T010): выбор режима `telegram`/`indexeddb` по правилам contracts/storage.md; круговое `save`/`load`; запись в неактивный слот — «Прерванная запись оставляет `meta` на старом, целом слоте» (симулировать сбой после записи частей); `KEY_MISSING` и вызов `restoreItem`; `wipe()` удаляет данные и ключ; моки `fetch` и `XMLHttpRequest` падают при любом вызове (FR-020)

### Implementation for Foundational

- [ ] T012 [P] Реализовать `Money`, `Currency = "RUB"`, `add`, `sub`, `allocateBp` в `src/domain/money.ts` (чистые функции, без зависимостей)
- [ ] T013 [P] Реализовать типизированную обёртку `TelegramWebApp` в `src/telegram/webapp.ts`: `getWebApp(): TelegramWebApp | null`, промисы над колбэками DeviceStorage/SecureStorage, `ready()`, `expand()`, тема из `themeParams` в CSS-переменные; `initData` и `user.id` не читаются (research.md R10)
- [ ] T014 [P] Реализовать AES-GCM конверт в `src/storage/crypto.ts`: `generateKey`, `exportKeyBase64`/`importKeyBase64` (режим telegram), `encrypt(key, bytes) → { iv, ciphertext }`, `decrypt`
- [ ] T015 [P] Описать Zod-схему `AppState` (`schemaVersion: 1`, `profiles`, `draft`, `recommendations`, `plans`, `activePlanId`, `localStorageNoticeAcknowledgedAt`) и функцию `migrate(raw)` в `src/storage/app-state.ts` по data-model.md «AppState»
- [ ] T016 Реализовать `src/storage/telegram-storage.ts`: ключ в SecureStorage `mc.key.v1`, данные в DeviceStorage `mc.state.meta` + `mc.state.<slot>.0…n`, части ≤ 32 КБ, слоты a/b по contracts/storage.md (зависит от T013, T014)
- [ ] T017 [P] Реализовать `src/storage/indexeddb-storage.ts`: БД `money-control`, хранилища `keys` (`CryptoKey`, `extractable: false`) и `state` (зависит от T014)
- [ ] T018 Реализовать `createRepository` и `StateRepository` в `src/storage/repository.ts`: выбор режима, `LoadError`/`SaveError` из contracts/storage.md, запрет молчаливой смены режима (зависит от T015–T017; T011 должен пройти)
- [ ] T019 [P] Создать словарь строк `src/ui/i18n/ru.ts` и хелпер `t(key, params)` с форматированием сумм `Intl.NumberFormat('ru-RU', { style: 'currency', currency })` из копеек
- [ ] T020 Создать каркас приложения в `src/app.tsx`: загрузка состояния через репозиторий, контекст `AppStateProvider` с `dispatch` и автосохранением, простой роутер экранов, экран ошибки хранилища для `LoadError` (зависит от T018, T019)
- [ ] T021 [P] Создать доступные базовые компоненты в `src/ui/components/`: `MoneyInput` (ввод в рублях, хранение в копейках, `inputmode="decimal"`, подпись и текст ошибки связаны через `aria-describedby`), `Choice` (радиогруппа), `StepLayout`, `Disclaimer`; ширина от 320 px
- [ ] T022 Спайк: проверить DeviceStorage и SecureStorage в Telegram iOS/Android, Desktop и Web на тестовом боте; записать результат (какой режим выбран на каком клиенте) в `specs/001-budget-method-recommendation/research.md` раздел R2 «Risk» (зависит от T018, T020)

**Checkpoint**: фундамент готов — можно начинать истории

---

## Phase 3: User Story 1 - Заполнить финансовый профиль и получить рекомендацию (Priority: P1) 🎯 MVP

**Goal**: анкета → показатели → скоринг по `scoring-rules@1.0.0` → экран рекомендации с факторами,
альтернативой и дисклеймером; режим дефицита

**Independent Test**: пройти анкету с профилями E1, E2, E3, E4 из
[contracts/scoring-rules-v1.md](contracts/scoring-rules-v1.md) и получить ожидаемый метод,
альтернативу и факторы

### Tests for User Story 1 ⚠️

> Написать первыми и убедиться, что падают

- [ ] T023 [P] [US1] Эталонные фикстуры профилей E1–E4 в копейках с ожидаемыми `metrics`, `scores`, `recommendedMethodId`, `alternativeMethodId`, `factors` в `tests/fixtures/profiles/e1-stable-salary.json`, `e2-freelancer.json`, `e3-high-debt.json`, `e4-deficit.json`
- [ ] T024 [P] [US1] Тесты валидации анкеты в `tests/unit/profile.spec.ts`: «`monthlyIncome` > 0»; «`incomeMin` ≤ `monthlyIncome`», «`incomeMax` ≥ `monthlyIncome`», обязательны «если `incomeType ≠ fixed`»; «`debtTotal` ≥ 0; если `debtPayments > 0`, то `> 0`»; «`dependents` 0–20»; `mandatoryExpenses + debtPayments ≤ 100 × monthlyIncome`; ошибки возвращаются как `FieldError[]`, а не исключения
- [ ] T025 [P] [US1] Тесты показателей в `tests/unit/metrics.spec.ts` по формулам data-model.md «ProfileMetrics», включая `savingsMonthsX10` = 120 при `obligations = 0` и `isIrregular` при `stabilityBp < 7 000`
- [ ] T026 [P] [US1] Тесты скоринга в `tests/unit/scoring.spec.ts`: E1–E4 по фикстурам T023; детерминизм (два вызова → равные результаты); ничья решается меньшим `order`; факторы — «не больше 4», по убыванию баллов, при равенстве — по порядку правил; при `isDeficit` правила не вызываются
- [ ] T027 [P] [US1] E2E сценарии US1.1–US1.4 из spec.md в `tests/e2e/us1-recommendation.spec.ts` (мок Telegram из T010); плюс edge cases: прерванная анкета продолжается после перезагрузки (FR-004), ошибка рядом с полем при отрицательной сумме (FR-003), режим дефицита (FR-012)

### Implementation for User Story 1

- [ ] T028 [P] [US1] Zod-схемы `FinancialProfileInput`, `FinancialProfile`, `QuestionnaireDraft` и `validateProfileInput`/`validateDraft` в `src/domain/profile.ts` (поля и правила — data-model.md «FinancialProfile», «QuestionnaireDraft»)
- [ ] T029 [P] [US1] `computeMetrics` в `src/domain/metrics.ts` (data-model.md «ProfileMetrics»)
- [ ] T030 [P] [US1] Каталог методов `METHODS` (id, `order`, `titleKey`, `descriptionKey`, `minSavingsBp`, `hasWeeklyLimits`) в `src/domain/methods/catalog.ts` по таблице contracts/scoring-rules-v1.md §2
- [ ] T031 [US1] Правила `SCORING_RULES_V1` (R1–R13, `version: "1.0.0"`) в `src/domain/scoring/rules-v1.ts` (зависит от T029, T030)
- [ ] T032 [US1] Движок `recommend(profile, rules, ctx)` и выбор факторов в `src/domain/scoring/engine.ts`; результат — `Recommendation` с `decision: "pending"`, `rulesVersion`, `profileId` (зависит от T031; T026 должен пройти)
- [ ] T033 [P] [US1] Строки анкеты, методов, правил (`explanationKey` с параметрами вроде доли трат в %), режима дефицита и дисклеймера в `src/ui/i18n/ru.ts`; тексты дефицита нейтральные и с конкретным следующим шагом (принцип VI)
- [ ] T034 [US1] Экран приветствия с уведомлением о локальном хранении (FR-020a, запись `localStorageNoticeAcknowledgedAt`) в `src/ui/screens/Welcome.tsx`
- [ ] T035 [US1] Анкета из 4 шагов (доход → обязательные траты и долги → семья и сбережения → цель и контроль, 11 вопросов) с сохранением черновика на каждом шаге и `MainButton`/`BackButton` Telegram в `src/ui/screens/Questionnaire.tsx` (зависит от T028, T021)
- [ ] T036 [US1] Экран рекомендации в `src/ui/screens/Recommendation.tsx`: метод и описание, факторы с объяснениями, альтернатива, дисклеймер (FR-011), режим дефицита с суммой дефицита и следующими шагами (зависит от T032, T033)
- [ ] T037 [US1] Подключить поток Welcome → Questionnaire → Recommendation в `src/app.tsx`: сохранение профиля и рекомендации в `AppState`, удаление черновика после сохранения профиля

**Checkpoint**: US1 работает и проверяется отдельно — это MVP

---

## Phase 4: User Story 2 - Получить план бюджета по выбранному методу (Priority: P2)

**Goal**: принять или заменить рекомендацию, получить месячный план до копейки, недельные лимиты,
ручная корректировка

**Independent Test**: для профилей E1, E2, E5, E6 построить план и сверить суммы с
contracts/scoring-rules-v1.md до копейки; Σ частей = доход

### Tests for User Story 2 ⚠️

- [ ] T038 [P] [US2] Тесты планов в `tests/unit/plans.spec.ts`: E1 (60 000 / 36 000 / 24 000), E2 (`base_plus_buffer`: obligations 30 000, savings 4 000, flexible 6 000, bufferTarget 90 000), E6 (округление → savings 2 000 021); для всех шести методов и набора случайных профилей — «Σ parts.amount === income.amount»; `SAVINGS_BELOW_MIN`, `OBLIGATIONS_EXCEED_NEEDS`
- [ ] T039 [P] [US2] Тесты недельных лимитов в `tests/unit/weekly-limits.spec.ts`: E5 (декабрь 2026: 774 193; 903 225 × 3; 516 132 коп.), месяц, начинающийся с понедельника, февраль невисокосного года; «Σ limit.amount === flexible.amount»
- [ ] T040 [P] [US2] Тесты `adjustPart` и `decide` в `tests/unit/adjust-decide.spec.ts`: перераспределение по частям без `isManual` и `isFixed` пропорционально; `MANUAL_PARTS_EXCEED_INCOME`; `PART_IS_FIXED`; переходы `pending → accepted`, `pending → overridden`, `accepted → overridden`; итоговые состояния не возвращаются в `pending`
- [ ] T041 [P] [US2] E2E сценарии US2.1–US2.4 из spec.md в `tests/e2e/us2-plan.spec.ts`

### Implementation for User Story 2

- [ ] T042 [P] [US2] Построители частей плана для `rule_50_30_20`, `rule_70_20_10`, `pay_yourself_first` в `src/domain/methods/percent-methods.ts`
- [ ] T043 [P] [US2] Построители для `weekly_limits`, `envelopes`, `base_plus_buffer` (с `surplusRule`: «5000 б.п. в буферный фонд, 3000 — в накопления, 2000 — свободно», `bufferTarget = 3 × obligations`) в `src/domain/methods/obligation-methods.ts`
- [ ] T044 [P] [US2] `splitByWeeks(flexible, period)` в `src/domain/methods/weekly.ts`: недели с понедельника, обрезка границами месяца, остаток — в последнюю неделю
- [ ] T045 [US2] `buildPlan` в `src/domain/methods/build-plan.ts`: выбор построителя, остаток округления в `savings`, предупреждения (зависит от T042–T044; T038, T039 должны пройти)
- [ ] T046 [US2] `adjustPart` в `src/domain/methods/adjust.ts` и `decide` в `src/domain/history.ts` (T040 должен пройти)
- [ ] T047 [P] [US2] Строки экрана плана, частей бюджета, предупреждений и каталога методов в `src/ui/i18n/ru.ts`
- [ ] T048 [US2] Кнопки «Принять» и «Выбрать другой метод» (каталог с описаниями) на `src/ui/screens/Recommendation.tsx` и экран выбора `src/ui/screens/MethodCatalog.tsx`
- [ ] T049 [US2] Экран плана в `src/ui/screens/Plan.tsx`: части с суммами, недельные лимиты, правило дохода сверх базы, ручная правка суммы с предупреждениями; отображение ≤ 1 с после выбора метода (SC-006) (зависит от T045, T046)
- [ ] T050 [US2] Подключить решение и план в `src/app.tsx`: сохранение `decision`, `chosenMethodId`, `BudgetPlan`, `activePlanId`; при наличии активного плана приложение открывается на экране плана

**Checkpoint**: US1 и US2 работают каждая отдельно

---

## Phase 5: User Story 3 - Обновить профиль и увидеть, изменилась ли рекомендация (Priority: P3)

**Goal**: редактирование профиля, пересчёт рекомендации с объяснением изменений, история

**Independent Test**: изменить долговую нагрузку в профиле E3 (погасить кредит) → новая
рекомендация с объяснением изменившегося фактора; старая — в истории с датой и версией правил

### Tests for User Story 3 ⚠️

- [ ] T051 [P] [US3] Тесты `diffMetrics` в `tests/unit/diff-metrics.spec.ts`: E3 с `debtPayments = 0` → изменение `debtLoadBp` и `mandatoryShareBp`; без изменений → пустой список
- [ ] T052 [P] [US3] E2E сценарии US3.1–US3.3 из spec.md в `tests/e2e/us3-history.spec.ts`

### Implementation for User Story 3

- [ ] T053 [P] [US3] `diffMetrics` в `src/domain/metrics.ts`
- [ ] T054 [US3] Редактирование профиля в `src/ui/screens/Questionnaire.tsx` (режим правки с предзаполнением): сохраняется новая версия `FinancialProfile` с новым `id`, вызывается `recommend`
- [ ] T055 [US3] Экран результата пересчёта в `src/ui/screens/Recommendation.tsx`: «метод остаётся подходящим» с обновлением сумм плана или новый метод с перечнем изменившихся факторов и предложением перейти
- [ ] T056 [US3] Экран истории в `src/ui/screens/History.tsx`: рекомендации с датой, версией правил, методом и решением (FR-018)

**Checkpoint**: все истории работают отдельно

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: управление данными (FR-021) и требования, общие для всех историй

### Tests ⚠️

- [ ] T057 [P] Тесты экспорта/импорта в `tests/integration/export-import.spec.ts`: файл соответствует `contracts/export-file.schema.json`; круговой экспорт→импорт; повреждённый или чужой файл отклоняется без изменения данных; подтверждение перед заменой существующих данных
- [ ] T058 [P] E2E «Настройки данных» в `tests/e2e/data-settings.spec.ts`: экспорт, удаление всех данных, импорт, отображение режима хранения

### Implementation

- [ ] T059 Экспорт, импорт и удаление в `src/storage/export-import.ts` (валидация Zod-схемой, эквивалентной `contracts/export-file.schema.json`; отдача файла через `downloadFile` с запасным вариантом — ссылка для скачивания)
- [ ] T060 Экран «Настройки данных» в `src/ui/screens/DataSettings.tsx`: режим хранения, экспорт с предупреждением «файл не зашифрован», импорт, полное удаление с подтверждением
- [ ] T061 [P] Проверка доступности: навигация с клавиатуры по всем экранам, подписи полей, контраст в светлой и тёмной темах Telegram; автоматизировать через `@axe-core/playwright` в `tests/e2e/a11y.spec.ts`
- [ ] T062 [P] Тест производительности в `tests/unit/perf.spec.ts`: `recommend` + `buildPlan` ≤ 50 мс на 1 000 случайных профилей в среднем
- [ ] T063 [P] README в `README.md`: что это, как запустить, ссылки на конституцию и спек, как подключить бота
- [ ] T064 Пройти [quickstart.md](quickstart.md) целиком, включая ручную проверку в Telegram на телефоне и Desktop; убедиться, что во вкладке Network нет запросов с пользовательскими данными

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: после Setup — блокирует все истории
- **US1 (Phase 3)**: после Foundational
- **US2 (Phase 4)**: после Foundational; использует `Recommendation` и профиль из US1. Доменные задачи (T038–T046) можно делать параллельно с US1, экраны (T048–T050) — после T036
- **US3 (Phase 5)**: после US1; экран обновления сумм плана (T055) — после US2
- **Polish (Phase 6)**: T057–T060 — после Foundational; T061, T064 — после всех историй

### Within Each Phase

- Тесты пишутся первыми и падают
- Домен → хранилище → UI → подключение в `src/app.tsx`
- Коммит после каждой задачи или логической группы

### Parallel Opportunities

- Setup: T003, T004, T005, T006, T007
- Foundational: тесты T008, T009, T010; реализация T012, T013, T014, T015, затем T016 и T017
- US1: тесты T023–T027 вместе; T028, T029, T030 вместе
- US2: тесты T038–T041 вместе; T042, T043, T044 вместе
- Между историями: доменная часть US2 параллельно с UI US1

---

## Parallel Example: User Story 1

```bash
# Тесты US1 одновременно:
Task: "Эталонные фикстуры E1–E4 в tests/fixtures/profiles/"
Task: "Тесты валидации анкеты в tests/unit/profile.spec.ts"
Task: "Тесты показателей в tests/unit/metrics.spec.ts"
Task: "Тесты скоринга в tests/unit/scoring.spec.ts"

# Доменные модули US1 одновременно:
Task: "Zod-схемы профиля в src/domain/profile.ts"
Task: "computeMetrics в src/domain/metrics.ts"
Task: "Каталог методов в src/domain/methods/catalog.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational, включая спайк T022 по хранилищам
3. Phase 3: US1
4. **STOP and VALIDATE**: эталоны E1–E4 зелёные, анкета проходится в Telegram на телефоне
5. Опубликовать для первых пользователей

### Incremental Delivery

1. Setup + Foundational → фундамент
2. US1 → рекомендация (MVP)
3. US2 → план бюджета
4. US3 → пересчёт и история
5. Polish → экспорт/импорт/удаление, доступность, quickstart

---

## Notes

- [P] — разные файлы, нет зависимостей
- Любое изменение чисел в правилах скоринга — новая версия правил (contracts/scoring-rules-v1.md)
- Суммы — только `Money` в копейках; `number` с плавающей точкой для денег запрещён (принцип I)
- Пользовательские данные никогда не уходят в сеть и в логи (принцип II)
