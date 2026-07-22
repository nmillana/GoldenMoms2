# Tesoreria Redesign - Ejecucion Local-Only

Este proyecto queda preparado por la via 2: codigo local + SQL preparado. Nada de este documento significa que la base real ya fue migrada, validada o asegurada.

## Estado

- Implementado en codigo local: `treasury-redesign.js`, cargado despues de `app.js` desde `index.html`.
- Preparado en SQL: `supabase/sql/001_treasury_diagnostic_queries.sql` a `008_treasury_rollback.sql`.
- Pendiente: ejecutar diagnosticos en Supabase, revisar resultados, respaldar, aplicar SQL por etapas y validar RLS/roles.

## Orden recomendado

1. Ejecutar `001_treasury_diagnostic_queries.sql` y devolver resultados antes de aplicar cambios.
2. Respaldar/exportar tablas legacy: `fees`, `fee_payments`, `expenses`, `expense_payments`, `treas_events`, `treas_event_payments`, `players`, `player_users`.
3. Ejecutar `002_treasury_schema.sql`.
4. Ejecutar `003_treasury_constraints.sql`.
5. Ejecutar `004_treasury_rpc.sql`.
6. Revisar autenticacion/roles. Solo despues ejecutar `005_treasury_rls.sql`.
7. Ejecutar secciones A, B, E, F, I de `007_treasury_validation_queries.sql`.
8. Ejecutar `006_treasury_historical_migration.sql`.
9. Ejecutar completo `007_treasury_validation_queries.sql` y comparar saldos.
10. Si algo no cuadra, usar `008_treasury_rollback.sql` con `set_config('gm.rollback_batch', 'legacy-treasury-20260722', false)`.

## Resultados que necesito para validar

- Salida completa de `001_treasury_diagnostic_queries.sql`.
- Salida de `007_treasury_validation_queries.sql`, especialmente:
  - balance legacy estimado;
  - balance migrado por movimientos;
  - duplicados;
  - pendientes;
  - DT pendiente;
  - politicas RLS.

## Advertencias

- El login actual de la app es custom sobre `player_users`; las politicas RLS preparadas esperan claims/JWT con rol `admin`, `capitana` o `tesorera`.
- El overlay local lee legacy si las tablas nuevas no existen, pero las operaciones financieras nuevas llaman RPC. En modo legacy no simula transacciones.
- La migracion historica no borra datos antiguos ni borra filas nuevas en rollback; usa trazabilidad, estados y movimientos compensatorios.
