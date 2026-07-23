# Tesoreria Redesign - Ejecucion Local-Only

Este proyecto queda preparado por la via 2: codigo local + SQL preparado. Nada de este documento significa que la base real ya fue migrada, validada o asegurada.

## Estado

- Implementado en codigo local: `treasury-redesign.js`, cargado despues de `app.js` desde `index.html`.
- Preparado en SQL: `supabase/sql/001_treasury_diagnostic_queries.sql` a `009_treasury_custom_auth_bridge.sql` y, si ya habias ejecutado una version anterior, `010_treasury_fix_pgcrypto_hash.sql`.
- Pendiente despues de la migracion historica: ejecutar `009_treasury_custom_auth_bridge.sql`, aplicar `010_treasury_fix_pgcrypto_hash.sql` si corresponde, ejecutar `005_treasury_rls.sql` y validar acceso desde la app.

## Orden recomendado

1. Ejecutar `001_treasury_diagnostic_queries.sql` y devolver resultados antes de aplicar cambios.
2. Respaldar/exportar tablas legacy: `fees`, `fee_payments`, `expenses`, `expense_payments`, `treas_events`, `treas_event_payments`, `players`, `player_users`.
3. Ejecutar `002_treasury_schema.sql`.
4. Ejecutar `003_treasury_constraints.sql`.
5. Ejecutar `004_treasury_rpc.sql`.
6. Ejecutar secciones A, B, E y F de `007_treasury_validation_queries.sql`.
7. Ejecutar `006_treasury_historical_migration.sql`.
8. Ejecutar completo `007_treasury_validation_queries.sql` y comparar saldos.
9. Ejecutar `009_treasury_custom_auth_bridge.sql` para compatibilidad con el login custom actual.
10. Si ya habias ejecutado una version anterior de `009` y el login muestra error tecnico, ejecutar `010_treasury_fix_pgcrypto_hash.sql`.
11. Ejecutar `005_treasury_rls.sql` para activar RLS usando la sesion temporal de Tesorera.
12. Ejecutar completo `007_treasury_validation_queries.sql` y probar ingreso a Tesorera desde la app.
13. Si algo no cuadra, usar `008_treasury_rollback.sql` con el batch legacy-treasury-20260722.

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

- El login actual de la app es custom sobre `player_users`; `009_treasury_custom_auth_bridge.sql` habilita sesiones temporales, `010_treasury_fix_pgcrypto_hash.sql` corrige compatibilidad pgcrypto si aplica y `005_treasury_rls.sql` valida esas sesiones con `x-gm-treasury-session`.
- El overlay local lee legacy si las tablas nuevas no existen, pero las operaciones financieras nuevas llaman RPC. En modo legacy no simula transacciones.
- La migracion historica no borra datos antiguos ni borra filas nuevas en rollback; usa trazabilidad, estados y movimientos compensatorios.
