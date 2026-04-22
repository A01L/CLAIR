# Clair - Платформа сбора, классификации и аналитики обращений

Clair — это мощная backend-система для обработки пользовательских отзывов, жалоб и предложений. Проект собирает обращения через интеграцию каналов (API keys), анализирует их с помощью Google Gemini AI (классификация, оценка эмоций, выявление спама и аномалий), и предоставляет клиентам dashboard для работы с обращениями.

## Функционал
- **AI Classification**: Автоматическое определение тональности (emotion), типа (bug, suggestion, request) и формирование кратких выжимок с помощью Gemini.
- **Custom Prompts & Moderation**: Владельцы каналов могут задавать свои собственные инструкции для AI, которые проходят автоматическую модерацию на токсичность и Prompt Injection перед сохранением.
- **Anti-spam & Deduplication**: Алгоритм хеширования выявляет дубликаты и спам-атаки, увеличивая `spam_score` и снижая нагрузку на API (пропуская вызов AI).
- **AI Assistant**: Виджет или API-клиент для общения пользователей с AI-ассистентом, который имеет контекст частых проблем конкретного канала.
- **Elasticsearch**: Быстрый и нечеткий полнотекстовый поиск по истории обращений, ответам и решениям AI.
- **Redis Cache**: Кэширование агрегированной статистики (Heatmap/Geo) и тяжелых запросов для ускорения дашборда.
- **RabbitMQ Worker & DLQ**: Асинхронная очередь для обработки входящих обращений с поддержкой Dead Letter Queue для неудачных попыток.
- **Geo / IP Metadata**: Обогащение запросов гео-информацией по IP-адресу.

## Стек технологий
- **Core**: Node.js, Express
- **Database**: PostgreSQL
- **Message Broker**: RabbitMQ
- **Cache**: Redis
- **Search**: Elasticsearch 8
- **AI / LLM**: @google/generative-ai (Gemini 2.5 Flash)
- **Infrastructure**: Docker, Docker Compose

## Структура проекта
Вся логика приложения вынесена в папку `src/`:

```text
clair/
├── Dockerfile                  # Конфигурация образа приложения и воркера
├── docker-compose.yml          # Оркестрация всей инфраструктуры (DB, Redis, RabbitMQ, Elastic)
├── src/
│   ├── app.js                  # Главный входной файл Express сервера
│   ├── worker.js               # Асинхронный обработчик очереди (RabbitMQ consumer)
│   ├── resumePausedBacklog.js  # Скрипт для повторной обработки DLQ/замороженных очередей
│   ├── cache/                  # Интеграция с Redis (redis.js)
│   ├── controllers/            # Express-контроллеры (appeals, channels, assistant, reports и др.)
│   ├── db/                     # Подключение к PostgreSQL и миграции (db.js, migrations.sql)
│   ├── middlewares/            # Middleware для проверки JWT и Channel API Key
│   ├── prompts/                # Логика сборки промптов (global + custom)
│   ├── queue/                  # Логика работы с RabbitMQ (rabbit.js)
│   ├── routes/                 # Маршрутизация API
│   ├── search/                 # Интеграция с Elasticsearch (elastic.js)
│   ├── services/               # Сервисный слой (Модерация промптов, Anti-Spam, IP Metadata, Gemini Client)
│   └── utils/                  # Утилиты (Криптография ключей, парсинг запросов)
├── .env.example                # Пример переменных окружения
└── README.md
```

## Как запускать и собрать

### 1. Подготовка окружения
Скопируйте пример файла конфигурации или создайте `.env` в корне проекта:
```bash
# Пример .env файла
GEMINI_API_KEY=ваш_ключ_от_google_ai_studio
JWT_SECRET=super_secret_change_me
KEY_ENCRYPTION_SECRET=super_secret_encryption_key_32_bytes_long

PGHOST=postgres
PGPORT=5432
PGUSER=postgres
PGPASSWORD=clair_pass
PGDATABASE=clair

RABBIT_USER=guest
RABBIT_PASS=guest
RABBIT_URL=amqp://guest:guest@rabbitmq:5672

REDIS_URL=redis://redis:6379
ELASTIC_URL=http://elasticsearch:9200
```

### 2. Запуск через Docker (Рекомендуемый способ)
Проект полностью докеризирован. Одной командой поднимается база данных, очереди, кэш, поисковый движок, сервер и воркер:

```bash
# Сборка и запуск всех сервисов в фоновом режиме
docker compose up -d --build
```

После запуска:
- **API Server**: http://localhost:3000
- **RabbitMQ Dashboard**: http://localhost:15672 (guest:guest)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Elasticsearch**: http://localhost:9200

### 3. Запуск для локальной разработки (Dev Mode)
Если вы хотите запускать код локально, вне докера, но использовать контейнеры для инфраструктуры:

1. Запустите инфраструктуру:
   ```bash
   docker compose up -d postgres rabbitmq redis elasticsearch
   ```
2. Отредактируйте `.env`, поменяв хосты на `localhost` (например, `PGHOST=127.0.0.1`).
3. Установите зависимости:
   ```bash
   npm install
   ```
4. Запустите сервер (в первом терминале):
   ```bash
   npm run dev &
   ```
5. Запустите воркер (во втором терминале):
   ```bash
   npm run worker &
   ```

### 4. Применение SQL Миграций
При первом запуске убедитесь, что структура таблиц в PostgreSQL создана. Основная схема лежит в `main.sql`, а миграции новых фич в `src/db/migrations.sql`.
Если вы используете Docker, вы можете применить их вручную:
```bash
docker exec -i clair_postgres psql -U postgres -d clair < main.sql
docker exec -i clair_postgres psql -U postgres -d clair < src/db/migrations.sql
```
