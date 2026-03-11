
# Golden Moms — Estructura de Módulos JS

## Archivos en raíz
```
index.html          → HTML puro (estructura)
styles.css          → Todo el CSS
app.js              → Monolito legacy (backup, ya no se usa)
sw.js               → Service Worker PWA
manifest.webmanifest → Config PWA
```

## Módulos (carpeta /modules)

### Capa base (sin dependencias)
| Archivo | Responsabilidad |
|---------|----------------|
| `state.js` | Estado compartido mutable (supa, currentUser, allPlayers, etc.) |
| `config.js` | Constantes de negocio (EVENT_TYPES, TEAMS, ALL_TEAMS) |

### Servicios
| Archivo | Responsabilidad |
|---------|----------------|
| `supabase.js` | Cliente Supabase, initSupabase(), updateConnStatus() |
| `helpers.js` | Utilidades: fechas, escapeHTML, showToast, showError |
| `auth.js` | Login 2 pasos, Supabase Auth, SHA-256 fallback, gestión usuarios |

### Módulos de dominio
| Archivo | Responsabilidad |
|---------|----------------|
| `events.js` | Modal eventos, convocatoria, calendario mensual, asistencia |
| `roster.js` | Modal jugadora, filtros plantel, exportar Excel |
| `dashboard.js` | Dashboard, KPIs, partidos, player personal dashboard |
| `attendance.js` | Asistencia rápida, carga resultado partido |
| `stats.js` | Tabla de posiciones interna de equipos |
| `board.js` | Tablón de anuncios |
| `fees.js` | Cuotas, mensualidades, tesorera, KPIs, WA helpers, notificaciones |
| `tournaments.js` | Torneos externos, tabla tipo fútbol |
| `expenses.js` | Registro de egresos y cobros |

### Infraestructura
| Archivo | Responsabilidad |
|---------|----------------|
| `router.js` | showView(), tabs, sincroniza estado visual |
| `main.js` | **Entry point** — DOMContentLoaded, orquesta boot |

## Árbol de dependencias
```
main.js
├── supabase.js → state.js
├── auth.js → state.js, helpers.js, router.js
├── router.js → supabase.js, dashboard.js, events.js, roster.js,
│               stats.js, board.js, fees.js, auth.js
├── dashboard.js → state.js, config.js, helpers.js
├── events.js → state.js, config.js, helpers.js, dashboard.js
├── roster.js → state.js, config.js, helpers.js, dashboard.js
├── attendance.js → state.js, config.js, helpers.js, dashboard.js
├── stats.js → state.js, config.js, helpers.js
├── board.js → state.js, config.js, helpers.js
├── fees.js → state.js, config.js, helpers.js
├── tournaments.js → state.js, helpers.js
├── expenses.js → state.js, config.js, helpers.js, fees.js
└── helpers.js (sin dependencias internas)
```

## Para agregar una nueva feature
1. Si es un módulo nuevo → crear `modules/nombre.js`
2. Importar `supa, IS_CONNECTED` de `./state.js`
3. Importar helpers de `./helpers.js`
4. Exportar las funciones públicas al final
5. Importar en `main.js` o en el módulo que lo invoque
