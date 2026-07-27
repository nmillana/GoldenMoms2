# Desafio fisico - Julio 2026

Fuente revisada: https://gymvirtual.com/wp-content/uploads/2026/06/Calendario-gymvirtual-julio26.pdf?x96925

## Que se cargo

- Mes: Julio 2026, publicado, activo y con ranking habilitado.
- Dias: 31 dias del calendario.
- Videos obligatorios: 74 videos.
- Domingos de Reto: 5, 12, 19 y 26 de julio quedan como `challenge` sin videos obligatorios ni puntaje.
- URLs: cada video conserva la URL fuente de GymVirtual y se guarda como YouTube embebible con `youtube-nocookie.com`.

## Revision por dia

| Fecha | Categoria | Videos |
| --- | --- | ---: |
| 2026-07-01 | Cardio | 4 |
| 2026-07-02 | Full Body Cardio | 5 |
| 2026-07-03 | GAP | 1 |
| 2026-07-04 | Express | 1 |
| 2026-07-05 | Reto | 0 |
| 2026-07-06 | Total Body | 3 |
| 2026-07-07 | Parte superior | 3 |
| 2026-07-08 | Cardio | 4 |
| 2026-07-09 | Full Body Cardio | 4 |
| 2026-07-10 | GAP | 1 |
| 2026-07-11 | Express | 1 |
| 2026-07-12 | Reto | 0 |
| 2026-07-13 | Total Body | 3 |
| 2026-07-14 | Parte superior | 4 |
| 2026-07-15 | Cardio | 4 |
| 2026-07-16 | Full Body Cardio | 4 |
| 2026-07-17 | GAP | 1 |
| 2026-07-18 | Express | 1 |
| 2026-07-19 | Reto | 0 |
| 2026-07-20 | Total Body | 3 |
| 2026-07-21 | Parte superior | 2 |
| 2026-07-22 | Cardio | 3 |
| 2026-07-23 | Full Body Cardio | 3 |
| 2026-07-24 | GAP | 1 |
| 2026-07-25 | Express | 1 |
| 2026-07-26 | Reto | 0 |
| 2026-07-27 | Total Body | 3 |
| 2026-07-28 | Parte superior | 4 |
| 2026-07-29 | Cardio | 4 |
| 2026-07-30 | Full Body Cardio | 5 |
| 2026-07-31 | GAP | 1 |

## Notas de implementacion

- El seed esta en `supabase/sql/019_fitness_july_2026_seed.sql` y debe ejecutarse despues de `supabase/sql/018_fitness_challenge.sql`.
- La carga es idempotente por mes/dia y por orden de video dentro del dia; reejecutar actualiza titulos y URLs sin duplicar esos registros.
- Los titulos se normalizaron a ASCII para evitar problemas de codificacion en SQL manual; las URLs y los IDs de YouTube son los datos criticos.
- No se ejecuto SQL contra Supabase desde Codex; queda listo para revisar y pegar en el SQL Editor.