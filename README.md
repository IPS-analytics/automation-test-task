# Тестовое задание: специалист по автоматизации

| Задача | Папка | Что внутри |
|---|---|---|
| 1. Telegram-бот с динамическим меню в n8n | [`task1-telegram-bot`](task1-telegram-bot) | экспорт workflow без секретов, тестовая таблица, инструкция запуска и сценарий демонстрации; 10 автотестов и прогон в n8n 2.46.4 |
| 2. План подключения Instagram для сбора статистики | [`task2-instagram-plan`](task2-instagram-plan) | схема реализации, пошаговый план по ролям, таблица метрик, план проверки, типичные проблемы, вопросы к компании |
| 3. Веб-сервис заявок с AI и Supabase | [`task3-requests-app`](task3-requests-app) | приложение (React + Supabase), SQL с RLS, проверка изоляции данных, настройка Supabase, описание работы с AI, известные ограничения |

**Приложение:** https://ips-analytics.github.io/automation-test-task/ · **Репозиторий:** https://github.com/IPS-analytics/automation-test-task

## Проверки

```bash
node --test task1-telegram-bot/test/workflow.test.mjs   # логика бота: 10 тестов
cd task3-requests-app && npm ci && npm run build        # типы и сборка приложения
npm run rls-check                                       # изоляция данных через API (нужен .env.local)
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) запускает первые две проверки на push в `main` и на каждый PR и публикует приложение на GitHub Pages из `main`.
