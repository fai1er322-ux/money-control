# Contract: Хранилище на устройстве (`src/storage`)

## Интерфейс

```ts
type StorageMode = "telegram" | "indexeddb";

interface StateRepository {
  readonly mode: StorageMode;
  load(): Promise<Result<AppState | null, LoadError>>;   // null — данных ещё нет
  save(state: AppState): Promise<Result<void, SaveError>>;
  wipe(): Promise<void>;                                   // FR-021: полное удаление
}

type LoadError =
  | "DECRYPT_FAILED" | "KEY_MISSING" | "KEY_RESTORE_DECLINED" | "SCHEMA_INVALID"
  | "MODE_UNAVAILABLE"      // данные лежат в Telegram-хранилище, а этот клиент его не даёт
  | "STORAGE_UNAVAILABLE";  // ошибка ввода-вывода хранилища
type SaveError =
  | "QUOTA_EXCEEDED" | "STORAGE_UNAVAILABLE" | "MODE_UNAVAILABLE"
  | "KEY_MISSING";          // ключа нет, а данные есть: новый ключ уничтожил бы их

createRepository(webApp: TelegramWebApp | null): Promise<StateRepository>;
```

## Выбор режима

1. `telegram`: `webApp.isVersionAtLeast("9.0")`, и есть `DeviceStorage` и `SecureStorage`.
2. Иначе `indexeddb` (Telegram Desktop/Web без поддержки, локальная разработка).

После первой записи в режиме `telegram` в IndexedDB (`money-control/meta`, ключ `mode`)
ставится отметка. Если позже на этом устройстве выбран режим `indexeddb`, а отметка есть,
`load` и `save` возвращают `MODE_UNAVAILABLE`: приложение показывает ошибку, а не начинает с
пустыми данными. `wipe()` снимает отметку.

## Ключи

| Режим | Где ключ | Где данные |
|---|---|---|
| `telegram` | SecureStorage `mc.key.v1` — AES-GCM 256, base64 | DeviceStorage `mc.state.meta` + `mc.state.<slot>.0…n` |
| `indexeddb` | IndexedDB `money-control/keys` — `CryptoKey`, `extractable: false` | IndexedDB `money-control/state` |

Если ключ отсутствует, а данные есть: в режиме `telegram` проверяется флаг восстановимости из
`SecureStorage.getItem` и вызывается `restoreItem`. Если восстановить нельзя → `KEY_MISSING`,
пользователю предлагается импорт из файла экспорта или начать заново.

## Формат записи

`mc.state.meta` (открытый JSON):
`{ "format": 1, "slot": "a" | "b", "chunks": n, "iv": "<base64>", "bytes": <длина шифртекста> }`

`mc.state.<slot>.i` — части base64-шифртекста по ≤ 32 КБ (на случай ограничений длины
значения). Шифрование: AES-GCM 256, новый IV на каждую запись.

Порядок записи: все части пишутся в неактивный слот, затем `meta` переключается на него, затем
части старого слота удаляются. Прерванная запись оставляет `meta` на старом, целом слоте.

## Гарантии

- Ни один метод не выполняет сетевых запросов (FR-020). Проверяется тестом с моком `fetch`
  и `XMLHttpRequest`, которые падают при вызове.
- Суммы и поля профиля не попадают в `console`, ошибки и телеметрию.
- `wipe()` удаляет и данные, и ключ в обоих хранилищах.
