/** Переводит ошибки Supabase и сети в понятный пользователю текст. */
export function errorMessage(error: unknown): string {
  const { code, message = '', name } = (error ?? {}) as { code?: string; message?: string; name?: string };

  if (name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  }

  switch (code) {
    case 'invalid_credentials':
      return 'Неверный email или пароль.';
    case 'email_not_confirmed':
      return 'Email не подтверждён — перейдите по ссылке из письма.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Пользователь с таким email уже зарегистрирован. Войдите.';
    case 'weak_password':
      return 'Слишком простой пароль: нужно не меньше 6 символов.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Проверьте адрес электронной почты.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Слишком много попыток. Подождите немного и повторите.';
    case 'signup_disabled':
      return 'Регистрация отключена администратором.';
    case 'PGRST301':
    case 'PGRST303':
      return 'Сессия истекла. Войдите снова.';
    case 'PGRST116':
    case '22P02':
      return 'Заявка не найдена или у вас нет к ней доступа.';
    case '42501':
      return 'Недостаточно прав для этого действия.';
    case '23514':
      return 'Данные не прошли проверку. Заполните все поля.';
  }

  return message ? `Не удалось выполнить действие: ${message}` : 'Что-то пошло не так. Попробуйте ещё раз.';
}
