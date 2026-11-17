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

  "welcome.lead":
    "Ответьте на 11 вопросов о доходе и тратах — подберём метод бюджета и объясним, почему он вам подходит.",
  "welcome.storageTitle": "Где хранятся ваши ответы",
  "welcome.storageNotice":
    "Только на этом устройстве, в зашифрованном виде: {mode}. Мы не отправляем их на сервер и не видим их. Если очистить данные Telegram или браузера, ответы пропадут.",
  "welcome.start": "Понятно, начать",

  "q.step.1": "Доход",
  "q.step.2": "Обязательные траты и долги",
  "q.step.3": "Семья и сбережения",
  "q.step.4": "Цель и контроль",
  "q.finish": "Получить рекомендацию",
  "q.incomeType": "Как вы зарабатываете?",
  "q.incomeType.fixed": "Фиксированная зарплата",
  "q.incomeType.fixed.hint": "Примерно одна и та же сумма каждый месяц",
  "q.incomeType.freelance": "Фриланс",
  "q.incomeType.freelance.hint": "Заказы и проекты, сумма меняется",
  "q.incomeType.mixed": "Смешанный",
  "q.incomeType.mixed.hint": "Зарплата плюс подработки",
  "q.incomeType.seasonal": "Сезонный",
  "q.incomeType.seasonal.hint": "Основной доход приходится на часть года",
  "q.monthlyIncome.fixed": "Чистый доход в месяц",
  "q.monthlyIncome.fixed.hint": "Сколько приходит на руки после налогов",
  "q.monthlyIncome.variable": "Средний доход в месяц",
  "q.monthlyIncome.variable.hint": "После налогов, в среднем за последние полгода",
  "q.incomeMin": "Доход в самый слабый месяц",
  "q.incomeMin.hint": "За последние полгода. От этой суммы будет строиться план",
  "q.incomeMax": "Доход в самый сильный месяц",
  "q.incomeMax.hint": "За последние полгода",
  "q.mandatoryExpenses": "Обязательные траты в месяц",
  "q.mandatoryExpenses.hint":
    "Жильё, коммунальные услуги, связь, лекарства. Платежи по долгам — в следующем вопросе",
  "q.debtPayments": "Платежи по долгам в месяц",
  "q.debtPayments.hint": "Кредиты, рассрочки, ипотека. Если долгов нет — 0",
  "q.debtTotal": "Сколько всего осталось выплатить",
  "q.debtTotal.hint": "Если долгов нет — 0",
  "q.dependents": "Сколько человек зависят от вашего дохода",
  "q.dependents.hint": "Дети и другие иждивенцы, не считая вас",
  "q.savings": "Сколько у вас отложено",
  "q.savings.hint": "Деньги, которые можно потратить в трудной ситуации. Если нет — 0",
  "q.goal": "Главная финансовая цель",
  "q.goal.emergency_fund": "Накопить подушку безопасности",
  "q.goal.big_purchase": "Накопить на крупную покупку",
  "q.goal.debt_payoff": "Закрыть долги",
  "q.goal.spending_control": "Взять траты под контроль",
  "q.controlLevel": "Насколько подробно готовы следить за тратами",
  "q.controlLevel.simple": "Просто",
  "q.controlLevel.simple.hint": "Пара цифр в месяц, без учёта каждой покупки",
  "q.controlLevel.detailed": "Подробно",
  "q.controlLevel.detailed.hint": "Готов распределять деньги по категориям и неделям",

  "integer.error.NOT_AN_INTEGER": "Введите целое число",

  "profile.error.REQUIRED": "Ответьте на этот вопрос",
  "profile.error.INVALID": "Проверьте значение",
  "profile.error.MUST_BE_POSITIVE": "Сумма должна быть больше нуля",
  "profile.error.MIN_EXCEEDS_AVERAGE": "Слабый месяц не может быть больше среднего дохода",
  "profile.error.MAX_BELOW_AVERAGE": "Сильный месяц не может быть меньше среднего дохода",
  "profile.error.DEBT_TOTAL_REQUIRED": "Укажите остаток долга — у вас есть ежемесячные платежи",
  "profile.error.OUT_OF_RANGE": "Введите целое число от 0 до {max}",
  "profile.error.IMPLAUSIBLE":
    "Траты больше дохода в {factor} раз — проверьте, нет ли лишних нулей",

  "method.rule_50_30_20.title": "50/30/20",
  "method.rule_50_30_20.description":
    "Половина дохода — на необходимое, 30 % — на желания, 20 % — в накопления.",
  "method.rule_70_20_10.title": "70/20/10",
  "method.rule_70_20_10.description":
    "70 % — на жизнь, 20 % — в накопления, 10 % — на досрочное погашение долгов или помощь близким.",
  "method.pay_yourself_first.title": "Сначала заплати себе",
  "method.pay_yourself_first.description":
    "В день дохода сразу откладываете 20 %, остальное тратите свободно. Минимум учёта.",
  "method.weekly_limits.title": "Недельные лимиты",
  "method.weekly_limits.description":
    "После обязательных платежей и накоплений остаток делится на недели — так проще дотянуть до конца месяца.",
  "method.envelopes.title": "Конверты",
  "method.envelopes.description":
    "Деньги после обязательных платежей раскладываются по категориям: еда, транспорт, досуг, прочее.",
  "method.base_plus_buffer.title": "Базовый доход + буфер",
  "method.base_plus_buffer.description":
    "План строится от дохода в самый слабый месяц, а всё сверх него идёт в буферный фонд и накопления.",

  "rule.R1_irregular_income":
    "Доход нестабилен: в слабый месяц вы получаете {stability} от среднего. План надёжнее строить от минимума.",
  "rule.R2_stable_income": "Доход стабилен — его удобно делить в процентах.",
  "rule.R3_low_obligations":
    "Обязательные траты и долги — {share} дохода: на желания и накопления остаётся достаточно.",
  "rule.R4_mid_obligations":
    "Обязательные траты и долги — {share} дохода: на жизнь нужна бо́льшая доля.",
  "rule.R5_high_obligations":
    "Обязательные траты и долги — {share} дохода: свободных денег мало, поможет жёсткий контроль трат.",
  "rule.R6_high_debt": "Высокая долговая нагрузка: платежи по долгам — {debtLoad} дохода.",
  "rule.R7_control_detailed": "Вы готовы подробно следить за тратами.",
  "rule.R8_control_simple": "Вам удобнее простой учёт без детализации.",
  "rule.R9_goal_emergency_low_savings":
    "Цель — подушка безопасности, а отложенного хватит на {savingsMonths} мес. обязательных трат.",
  "rule.R10_goal_big_purchase": "Цель — крупная покупка: откладывать стоит в первую очередь.",
  "rule.R11_goal_debt_payoff": "Цель — закрыть долги: важно контролировать каждую статью.",
  "rule.R12_goal_spending_control": "Цель — взять траты под контроль.",
  "rule.R13_dependents_low_savings":
    "От вашего дохода зависят другие люди ({dependents}), а запаса меньше чем на три месяца.",

  "rec.title": "Рекомендуем: {method}",
  "rec.why": "Почему этот метод",
  "rec.factorPoints": "+{points}",
  "rec.factorPointsLabel": "вклад в оценку: {points}",
  "rec.score": "Оценка: {score}",
  "rec.alternative": "Альтернатива",
  "rec.rulesVersion": "Правила подбора, версия {version}",
  "rec.editAnswers": "Изменить ответы",

  "deficit.title": "Сначала — свести доход и обязательные траты",
  "deficit.lead":
    "Обязательные траты и платежи по долгам больше дохода на {amount} в месяц. Пока это так, ни один метод бюджета не сработает — поэтому метод мы пока не предлагаем.",
  "deficit.stepsTitle": "С чего можно начать",
  "deficit.step1":
    "Выпишите обязательные траты и отметьте те, что можно пересмотреть: тарифы, подписки, аренду.",
  "deficit.step2":
    "Если платежи по кредитам слишком велики, спросите в банке о реструктуризации или кредитных каникулах.",
  "deficit.step3": "Подумайте, можно ли добавить доход: подработка, пересмотр ставки.",
  "deficit.step4": "Когда цифры изменятся, обновите ответы — и мы подберём метод.",
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
