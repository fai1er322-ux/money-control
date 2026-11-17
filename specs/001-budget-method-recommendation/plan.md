# Implementation Plan: Финансовый профиль и рекомендация метода бюджетирования

**Branch**: `001-budget-method-recommendation` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-budget-method-recommendation/spec.md`

## Summary

Telegram Mini App, в котором пользователь проходит анкету финансового профиля, получает
объяснимую рекомендацию метода бюджетирования из каталога шести методов и месячный план бюджета
в копейках. Ядро — чистый TypeScript-модуль без зависимостей от UI и Telegram: показатели
профиля, таблица правил скоринга версии 1.0.0, построение планов. Данные хранятся только на
устройстве: зашифрованный AES-GCM блок в DeviceStorage, ключ — в SecureStorage, с запасным
путём через IndexedDB. Сервера нет. Детали решений — в [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), ES2022

**Primary Dependencies**: React 19, Vite, Zod 4, `telegram-web-app.js` (официальный скрипт Telegram)

**Storage**: Telegram DeviceStorage (данные) + SecureStorage (ключ), запасной путь — IndexedDB +
неизвлекаемый ключ WebCrypto; шифрование AES-GCM 256

**Testing**: Vitest (домен, адаптеры), Testing Library (компоненты), Playwright (сквозные
сценарии с моком `window.Telegram.WebApp`)

**Target Platform**: Telegram Mini App (Bot API ≥ 9.0) в клиентах iOS, Android, Desktop и Web;
статический хостинг по HTTPS

**Project Type**: клиентское веб-приложение (SPA) без бэкенда

**Performance Goals**: план отображается ≤ 1 с после выбора метода (SC-006); расчёт скоринга
и плана ≤ 50 мс; первый экран ≤ 2 с на среднем телефоне при 4G

**Constraints**: никаких сетевых запросов с пользовательскими данными (FR-020); данные ≤ 5 МБ
(лимит DeviceStorage); суммы в целых копейках; интерфейс на русском с вынесенными строками;
доступность с клавиатуры и экранных читалок, ширина от 320 px

**Scale/Scope**: один пользователь на устройстве; ~8 экранов (приветствие, анкета из 4 шагов,
рекомендация, план, история, настройки данных); каталог из 6 методов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---|---|---|
| I. Финансовая точность | Копейки целыми числами, доли в базисных пунктах, остаток округления → «накопления», валюта в каждой сумме (`Money { amount, currency }`), чистые детерминированные функции | PASS |
| II. Приватность | Нет сервера и сетевых запросов с данными; AES-GCM шифрование при хранении; `initData`/`user.id` не сохраняются; экспорт и полное удаление (FR-021); логи без сумм | PASS |
| III. Объяснимые рекомендации | Таблица правил `scoring-rules@1.0.0`, вклад каждого правила, версия правил в каждой рекомендации, альтернатива, дисклеймер, ручной выбор метода | PASS |
| IV. Test-First | Эталонные профили (`tests/fixtures/profiles/*.json`) пишутся до кода скоринга и планов; тесты падают до реализации | PASS |
| V. Импорт как контракт | Импорт файла экспорта проверяется схемой Zod; повреждённый файл не меняет данные; подтверждение перед заменой. CSV/выписки — вне этой функции | PASS |
| VI. Этичная геймификация | Геймификации в этой функции нет; тексты режима дефицита нейтральные, с конкретным следующим шагом | PASS (N/A) |
| VII. Простота | Без бэкенда; одна обёртка над Telegram API вместо стороннего SDK; три runtime-зависимости (React, Zod, Telegram script) | PASS |
| Ограничения: платформа | Конституция требует зафиксировать платформу поправкой → поправка v1.1.0 вместе с этим планом | PASS |

**Post-design re-check (после Phase 1)**: нарушений нет. Модель данных хранит версию правил и
снимок профиля в каждой рекомендации (III); контракт хранилища запрещает сетевые вызовы (II);
каждая сумма в контрактах — `Money` в копейках (I).

## Project Structure

### Documentation (this feature)

```text
specs/001-budget-method-recommendation/
├── plan.md              # Этот файл
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── domain-api.md            # Публичный API доменного ядра
│   ├── scoring-rules-v1.md      # Таблица правил скоринга и методов
│   ├── storage.md               # Контракт адаптера хранения
│   └── export-file.schema.json  # JSON Schema файла экспорта
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── domain/                 # Чистый TS, без React/Telegram/IO
│   ├── money.ts            # Money, операции в копейках, распределение по долям
│   ├── profile.ts          # Схема анкеты (Zod), валидация
│   ├── metrics.ts          # Показатели профиля
│   ├── methods/            # Каталог методов и построители планов
│   ├── scoring/            # Правила v1, движок, объяснения
│   └── history.ts          # Рекомендации, решения, версии профиля
├── storage/
│   ├── crypto.ts           # AES-GCM конверт
│   ├── telegram-storage.ts # DeviceStorage + SecureStorage
│   ├── indexeddb-storage.ts# Запасной путь
│   ├── repository.ts       # Выбор режима, чтение/запись состояния
│   └── export-import.ts    # Файл экспорта, импорт, удаление
├── telegram/
│   └── webapp.ts           # Типизированная обёртка над window.Telegram.WebApp
├── ui/
│   ├── screens/            # Welcome, Questionnaire, Recommendation, Plan, History, DataSettings
│   ├── components/
│   └── i18n/ru.ts          # Все строки интерфейса
├── app.tsx
└── main.tsx

tests/
├── fixtures/profiles/      # Эталонные профили и ожидаемые результаты
├── unit/                   # domain/*, storage/crypto
├── integration/            # repository + mock Telegram, export/import
└── e2e/                    # Playwright: сценарии из spec.md
```

**Structure Decision**: одно клиентское приложение. Доменное ядро в `src/domain` изолировано
от UI и хранилища — его можно переиспользовать в будущем сервере бота (напоминания) и в
функции импорта транзакций.

## Complexity Tracking

Нарушений конституции нет — раздел не заполняется.
