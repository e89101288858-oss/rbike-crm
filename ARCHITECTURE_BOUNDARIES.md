# ARCHITECTURE_BOUNDARIES.md

## Цель
Развивать **две независимые продуктовые ветки** в одном репозитории:
1. `FRANCHISE` (историческая модель франшизы)
2. `SAAS` (отдельная SaaS-модель)

Любое изменение в одной ветке не должно неявно ломать или менять вторую.

---

## Обязательные правила

### 1) Явный домен для каждого endpoint
Каждый новый backend endpoint обязан быть помечен одним из режимов:
- `@TenantModes('FRANCHISE')`
- `@TenantModes('SAAS')`
- без метки только для truly shared/infrastructure endpoint (например auth/me)

### 2) Запрет смешанного доступа в бизнес-контроллерах
Для доменных контроллеров запрещено держать в `@Roles(...)` одновременно `FRANCHISEE` и `SAAS_USER`,
если endpoint не относится к явно shared контракту.

### 3) Раздельная навигация фронта
UI навигация должна быть раздельной:
- `franchiseOpsNav`
- `saasOpsNav`

Новые пункты добавляются только в соответствующую ветку.

### 4) SaaS billing только в SaaS-домене
- Backend: `@Roles('SAAS_USER') + @TenantModes('SAAS')`
- Frontend: меню/страницы биллинга только для SaaS

---

## Текущее состояние (Foundation v1)

Сделано:
- Введен `TenantModeGuard` + декоратор `TenantModes`.
- `TenantGuard` прокидывает `request.tenantMode`.
- SaaS billing endpoint'ы защищены mode+role.
- Frontend topbar разделен на `franchiseOpsNav` и `saasOpsNav`.

Следующий шаг:
- пройти все операционные контроллеры и расставить `TenantModes` по матрице,
- вынести действительно shared use-cases в отдельный слой.

---

## Политика PR
Любой PR, который добавляет бизнес-функционал без указания домена (FRANCHISE/SAAS),
считается архитектурно неполным и не должен мержиться.
