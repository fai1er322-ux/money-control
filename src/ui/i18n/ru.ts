/**
 * All user-facing strings (constitution: texts extracted for localization).
 * Placeholders use {name} syntax and are filled by `t()`.
 */
export const ru = {
  "app.title": "Money Control",
  "app.loading": "Загружаем ваши данные…",

  "common.next": "Далее",
  "common.back": "Назад",
  "common.cancel": "Отмена",
  "common.confirm": "Подтвердить",
  "common.stepOf": "Шаг {current} из {total}",
  "common.optional": "необязательно",

  "money.error.NOT_A_NUMBER": "Введите сумму цифрами, например 45 000 или 1 234,56",
  "money.error.NEGATIVE": "Сумма не может быть отрицательной",
  "money.error.TOO_MANY_DECIMALS": "Не больше двух знаков после запятой",
  "money.error.TOO_LARGE": "Слишком большая сумма",

  "disclaimer.text":
    "Рекомендации носят информационный характер и не являются персональной инвестиционной консультацией.",

  "home.placeholder": "Анкета и рекомендации появятся здесь.",
  "home.storageMode": "Хранилище: {mode}",
  "storage.mode.telegram": "Telegram на этом устройстве",
  "storage.mode.indexeddb": "браузер на этом устройстве",

  "storage.error.title": "Не удалось открыть ваши данные",
  "storage.error.DECRYPT_FAILED":
    "Данные на устройстве повреждены и не читаются. Можно восстановить их из файла экспорта или начать заново.",
  "storage.error.KEY_MISSING":
    "На устройстве нет ключа для расшифровки данных. Можно восстановить данные из файла экспорта или начать заново.",
  "storage.error.KEY_RESTORE_DECLINED":
    "Без доступа к ключу данные не расшифровать. Откройте приложение снова и разрешите восстановление ключа.",
  "storage.error.SCHEMA_INVALID":
    "Данные сохранены в неизвестном формате. Обновите Telegram или начните заново.",
  "storage.error.MODE_UNAVAILABLE":
    "Ваши данные хранятся в Telegram, но эта версия клиента не даёт к ним доступ. Обновите Telegram или откройте приложение на телефоне.",
  "storage.error.STORAGE_UNAVAILABLE":
    "Хранилище устройства сейчас недоступно. Закройте приложение и попробуйте ещё раз.",
  "storage.error.startOver": "Начать заново",
  "storage.error.startOverConfirm":
    "Все данные на этом устройстве будут удалены без возможности восстановления. Продолжить?",

  "storage.saveError.QUOTA_EXCEEDED": "Не хватает места на устройстве — изменения не сохранены.",
  "storage.saveError.STORAGE_UNAVAILABLE": "Не удалось сохранить изменения. Попробуйте ещё раз.",
  "storage.saveError.KEY_MISSING": "Не удалось сохранить: нет ключа шифрования.",
  "storage.saveError.MODE_UNAVAILABLE": "Не удалось сохранить: хранилище Telegram недоступно.",
} as const;

export type MessageKey = keyof typeof ru;
export type MessageParams = Record<string, string | number>;

export function t(key: MessageKey, params?: MessageParams): string {
  const template: string = ru[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
