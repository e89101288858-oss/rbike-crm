# Changelog

Все значимые изменения в проекте RBike CRM.

## [2026-02-17] — Owner/Admin/Auth/АКБ major update

### Added
- Owner Admin Panel `/admin`:
  - управление франчайзи и точками (create/update/archive/restore/delete),
  - аудит действий владельца.
- Настройки точки (tenant):
  - `dailyRateRub`,
  - `minRentalDays`.
- Отдельный модуль АКБ (`/batteries`):
  - CRUD,
  - archive/restore,
  - tenant-isolated workflows.
- Обязательная выдача АКБ при создании аренды (1 или 2).
- Операции АКБ в активной аренде:
  - довыдача второй АКБ,
  - замена АКБ,
  - журналирование событий.
- User management в owner panel:
  - список пользователей и ролей,
  - создание/редактирование/удаление,
  - смена роли,
  - активация/деактивация,
  - сброс пароля,
  - привязка/отвязка точек для MANAGER/MECHANIC,
  - фильтры и поиск по пользователям.
- Registration approval flow:
  - регистрация через заявку,
  - owner approve/reject,
  - назначение франчайзи и опционально точки.
- Централизованная русификация статусов в UI (`statusLabel`).

### Changed
- Login UX:
  - удалено поле Tenant ID,
  - tenant выбирается автоматически из доступных.
- Навигация переведена на левый sidebar с role-based видимостью.
- Платежи расширены редактированием и удалением из UI.
- Визуальный полиш админки:
  - мягкие карточки,
  - section titles,
  - summary chips.

### Fixed
- Исправлен тестовый импорт в backend `test/app.e2e-spec.ts`:
  - удалён некорректный `supertest/types`,
  - восстановлена корректная TS-проверка `--noUnusedLocals --noUnusedParameters`.

### Data model updates
- `Tenant.dailyRateRub`
- `Tenant.minRentalDays`
- `Battery`, `RentalBattery`, `BatteryStatus`
- `AuditLog`
- `RegistrationRequest`, `RegistrationRequestStatus`
- soft archive fields for operational entities (`isActive` where used)

### Notes
- Frontend/Backend builds are green.
- Frontend ESLint still contains technical debt (`no-explicit-any`, hooks deps warnings).

## [Previous milestones]

- Soft archive/restore for bikes and clients.
- CSV imports for bikes/clients with validation and summary.
- Rental/payment lifecycle improvements (extend/close/refund/edit/delete).
- Owner-first migration from console workflows to web UI.
