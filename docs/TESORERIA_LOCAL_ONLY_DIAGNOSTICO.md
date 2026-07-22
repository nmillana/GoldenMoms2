# Tesoreria Golden Moms - Diagnostico local-only

Fecha local: 2026-07-22
Modo de trabajo: implementacion local-only, sin ejecutar migraciones en Supabase.

## Fuente de verdad

Se leyo completo `C:/GM/TESORERIA_REDESIGN_SPEC.md`. El rediseno debe limitarse a Tesoreria, preservar datos historicos y preparar operaciones financieras atomicas mediante RPC/base de datos.

## Archivos realmente activos

`index.html` carga:

- Supabase desde CDN: `https://unpkg.com/@supabase/supabase-js@2`
- Service worker: `sw.js`
- Aplicacion activa: `app.js?v=20260721-5`

El README describe una arquitectura modular (`main.js`, `fees.js`, `auth.js`, etc.), pero esos modulos no estan conectados desde el HTML activo. Por compatibilidad, el rediseno se implementa sobre `app.js` y no se migra automaticamente al modelo modular.

## Modulo Tesoreria actual

La vista global activa es `#v-fees`, con pestana principal `data-view="fees"` y etiqueta `Tesorera`.

Estructuras DOM actuales relacionadas:

- `#treasLock`
- `#treasKpiRow`
- `#feesList`
- modal cuota: `#feeModalBg`
- modal evento tesorera: `#treasEventModalBg`
- modal egreso: `#expenseModalBg`

## Tablas legacy detectadas desde codigo

El codigo actual usa estas tablas financieras antiguas:

- `fees`
- `fee_payments`
- `expenses`
- `expense_payments`
- `treas_events`
- `treas_event_payments`

Tambien integra Plantel mediante:

- `players`
- `player_users`

## Problemas actuales frente a la especificacion

- Existen borrados fisicos de datos financieros (`delete`) en cuotas, egresos y eventos tesorera.
- Hay operaciones financieras con multiples `insert/update/delete` desde frontend, sin transaccion real.
- El saldo actual se calcula desde tablas legacy y no desde un libro unico de movimientos.
- Existen valores quemados, por ejemplo `MONTHLY_AMOUNT = 20000`.
- El rol `tesorera` no existe como rol activo comprobado; solo se prepara soporte futuro.
- No se puede validar RLS real localmente porque no hay `psql`, Supabase CLI ni credenciales de base.
- La app usa una sesion custom con `sessionStorage`; RLS real debe revisarse porque Supabase solo ve JWT/Auth, no esa sesion local.

## Estrategia local-only

1. Mantener `app.js` como archivo activo.
2. Crear una capa de dominio/servicio dentro de `app.js`, sin conectar modulos inactivos.
3. Implementar UI Tesoreria redisenada con vistas internas: Inicio, Ingresos, Actividades, Configuracion.
4. Usar modo `RPC-first` para operaciones criticas.
5. Si las tablas/RPC nuevas no existen, mostrar estado `pendiente de migracion` y usar lectura legacy solo para diagnostico/resumen, sin afirmar transaccionalidad.
6. Preparar SQL 001-008 sin ejecutarlo.
7. No borrar ni reemplazar tablas legacy.

## Archivos SQL planificados

- `001_treasury_diagnostic_queries.sql`
- `002_treasury_schema.sql`
- `003_treasury_constraints.sql`
- `004_treasury_rpc.sql`
- `005_treasury_rls.sql`
- `006_treasury_historical_migration.sql`
- `007_treasury_validation_queries.sql`
- `008_treasury_rollback.sql`

## Riesgos pendientes

- La validez de RLS no puede confirmarse sin inspeccion real en Supabase.
- Las RPC no pueden ejecutarse localmente.
- La migracion historica debe correrse primero en modo diagnostico y comparar cifras antes de confirmar uso productivo.
- La relacion exacta entre usuarios custom (`player_users`) y Supabase Auth debe validarse antes de activar RLS restrictivo.
