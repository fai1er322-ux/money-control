# Money Control

Карманный финансовый помощник в виде Telegram Mini App. Человек отвечает на 11 вопросов о
доходе, обязательных тратах, долгах и целях — приложение подбирает метод бюджетирования
(50/30/20, 70/20/10, «Сначала заплати себе», недельные лимиты, конверты, «базовый доход +
буфер»), объясняет выбор и строит план на месяц до копейки.

- Данные хранятся **только на устройстве**, зашифрованные AES-GCM: в DeviceStorage/SecureStorage
  Telegram (Bot API 9.0+) или в IndexedDB браузера. Сервера нет, регистрации нет.
- Подбор метода — прозрачная таблица правил с версией, без «чёрного ящика».
- Копию данных можно выгрузить в файл и загрузить на другом устройстве.

Сборка из `main` публикуется на GitHub Pages: https://fai1er322-ux.github.io/money-control/

## Документы

- Конституция проекта: [.specify/memory/constitution.md](.specify/memory/constitution.md)
- Спецификация первой функции: [specs/001-budget-method-recommendation/spec.md](specs/001-budget-method-recommendation/spec.md)
- План, модель данных и контракты: [plan.md](specs/001-budget-method-recommendation/plan.md),
  [data-model.md](specs/001-budget-method-recommendation/data-model.md),
  [contracts/](specs/001-budget-method-recommendation/contracts/)
- Правила подбора v1.0.0 с эталонными примерами: [scoring-rules-v1.md](specs/001-budget-method-recommendation/contracts/scoring-rules-v1.md)
- Задачи: [tasks.md](specs/001-budget-method-recommendation/tasks.md)

## Запуск

Нужен Node.js 22 или новее.

```bash
npm install
npm run dev
```

Вне Telegram приложение открывается в браузере и хранит данные в IndexedDB.

## Проверки

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`test:e2e` собирает приложение и прогоняет Playwright с заглушкой Telegram: приёмочные
сценарии, доступность (axe, светлая и тёмная темы) и отсутствие сетевых запросов с данными.
Если браузеры Playwright не скачаны (`npx playwright install chromium`), можно использовать
установленный Chrome: в PowerShell — `$env:PW_CHANNEL="chrome"; npm run test:e2e`.

## Структура

| Папка          | Что внутри                                                                |
| -------------- | ------------------------------------------------------------------------- |
| `src/domain`   | Чистое ядро без IO: деньги в копейках, анкета, показатели, скоринг, планы |
| `src/storage`  | Шифрование, хранилища Telegram и IndexedDB, экспорт и импорт              |
| `src/telegram` | Типизированная обёртка над `window.Telegram.WebApp`                       |
| `src/ui`       | React-экраны, компоненты, все строки интерфейса (`i18n/ru.ts`)            |
| `tests`        | Unit, integration и e2e тесты, эталонные профили E1–E4                    |

## Подключение к боту

1. Соберите приложение: `npm run build` — статика появится в `dist/`.
2. Опубликуйте `dist/` на любом статическом хостинге с HTTPS (или поднимите HTTPS-туннель к
   `npm run dev`).
3. В @BotFather: `/newbot`, затем _Bot Settings → Menu Button_ (или _Configure Mini App_) и
   укажите URL сборки.
4. Откройте бота и нажмите кнопку меню. Режим хранения виден на экране «Ваши данные».

Ручная проверка в клиентах Telegram описана в
[quickstart.md](specs/001-budget-method-recommendation/quickstart.md#ручная-проверка-в-telegram).
