# Programa General de Auditorías

Web app de Calidad — ZF El Salto que reemplaza el calendario anual en Excel y los recordatorios manuales.
Especificación: `Programa_General_Auditorias_SPEC.md` (no versionado).

| | |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind 4, TanStack Query, react-hook-form + zod, recharts (`frontend/`, puerto **5190**) |
| Backend | Node 22+ / Express 5 + Mongoose 9, zod, pino, exceljs, pdfkit (`backend/`, puerto **3045**, base `/api/v1`) |
| Worker | Proceso aparte (`src/worker.js`): recordatorios, escalaciones, resumen semanal, cierre de año |
| Base de datos | MongoDB 7+ (replica set recomendado: importaciones, reasignaciones y cambio de año usan transacciones) |
| Notificaciones | **Solo Microsoft Teams** (flujos de Workflows), con copia por correo opcional enviada por el mismo flujo |

## Funcionalidad (fases 1–4)

- **Acceso:** login propio, auto-registro (dominios de `ALLOWED_EMAIL_DOMAINS`, entran como Consulta), **2FA por Teams** en cada inicio de sesión, recuperación de contraseña con código por Teams.
- **Programa:** catálogo de auditorías, fechas programadas, matriz anual con los colores del Excel, KPI con **N/A** (no 0 %) cuando nada es exigible.
- **Ciclo de cada fecha:** registrar realizada con evidencia → validar/rechazar → reprogramar (solicitud/aprobación o directa) → cancelar / no realizada / reabrir.
- **Notificaciones (Teams):** recordatorios D-14/7/3/1, «vence hoy», aviso diario de vencida, escalación N1 (jefe) D+3, N2 (supervisores) D+7, N3 (gerente de planta) D+15, avisos por eventos (validación, reprogramación, reasignación), resumen semanal los lunes. Sin envíos en fines de semana ni días no laborables. Idempotente: nunca se envía lo mismo dos veces el mismo día.
- **Reportes:** cumplimiento por mes, tipo, cliente, grupo y responsable; exportación a **Excel** (mismo formato que el archivo actual) y **PDF** A3.
- **Administración:** usuarios y roles, grupos, días no laborables, importación del Excel, **cambio de año**, reglas de notificación, bitácora de notificaciones (con reintento), bitácora de cambios inalterable, configuración.

## Puesta en marcha (desarrollo)

```bash
# Backend
cd backend
cp .env.example .env        # ajusta MONGO_URI, JWT_SECRET (≥32 caracteres), ALLOWED_EMAIL_DOMAINS
npm install
npm run create-admin        # opcional: el API ya crea/repara el administrador fijo de .env al arrancar
npm run seed                # opcional: grupos del programa 2026 + usuarios demo (no producción)
npm run dev                 # API  → http://localhost:3045/api/v1/health
npm run worker:dev          # worker (otra terminal)

# Frontend (otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5190  (proxy /api → 3045)
```

### Administrador fijo
`ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD` en `.env` definen la cuenta de administrador, que el API **crea o repara en cada arranque**: roles Administrador + Responsable, supervisor de calidad, activa y con esa contraseña. Si alguien cambia la contraseña desde la app, vuelve a `ADMIN_PASSWORD` al reiniciar el API y las sesiones abiertas se cierran.
`ADMIN_EMAIL` es el correo real de la cuenta: ahí llegan sus códigos de Teams y sus avisos. `ADMIN_USERNAME` (por ejemplo `admin@zf.com`) es solo el **nombre de usuario para iniciar sesión** en esa misma cuenta; no es otro usuario y nadie puede registrarlo.
Para otros administradores: `npm run create-admin -- --email x@zf.com --name "Nombre" --password "Clave-2026-ok"`.

En desarrollo, sin URLs de Teams: el código de 2FA se imprime en la consola del API y las notificaciones quedan **simuladas** (`NOTIFICATIONS_DRY_RUN=true`), visibles en *Administración → Notificaciones enviadas*.

Ejecutar un trabajo manualmente (por ejemplo, para probar con una fecha fija):
```bash
npm run job:daily  -- --date 2026-10-05
npm run job:digest
node src/worker.js --run year-close --year 2025
```

## Los dos flujos de Teams (sin TI)

Ambos se crean desde **Teams → Workflows (Flujos de trabajo)** con el disparador **«When a Teams webhook request is received»**. No requiere licencia premium ni aprobación de TI; el flujo se ejecuta con tu cuenta (mejor: una cuenta compartida de Calidad, para que no dependa de una persona). La URL que genera el disparador va en `.env`; inventa un token largo para `*_API_TOKEN` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).

En cada flujo, el primer paso después del disparador es una **Condición**: `triggerOutputs()?['headers']?['x-api-key']` es igual a tu token. Si no lo es, termina el flujo (Terminate). Trata la URL del disparador como secreto.

### Flujo 1 — Códigos de verificación (2FA) → `TEAMS_2FA_WEBHOOK_URL`

```json
{ "email": "nombre.apellido@zf.com", "name": "Nombre Apellido", "code": "483920",
  "purpose": "LOGIN", "expiresInMinutes": 5, "appName": "Programa General de Auditorías" }
```
`purpose` puede ser `LOGIN` o `PASSWORD_RESET`. Acción: **Post message in a chat or channel** → *Post as:* Flow bot, *Post in:* Chat with Flow bot, *Recipient:* `email`, mensaje: «Tu código para {appName} es **{code}**. Vence en {expiresInMinutes} minutos.»

### Flujo 2 — Notificaciones → `TEAMS_NOTIFY_WEBHOOK_URL`

La aplicación arma el mensaje completo (tarjeta adaptativa en español con botón «Ver auditoría»); el flujo solo lo entrega:

```json
{
  "type": "REMINDER | DUE_TODAY | OVERDUE | ESCALATION | VALIDATION_REQUEST | VALIDATION_RESULT | RESCHEDULE_REQUEST | RESCHEDULE_RESULT | REASSIGNED | DIGEST | TEST",
  "level": 0,
  "recipient": { "email": "…", "name": "…" },
  "postToChat": true,
  "postToChannel": false,
  "sendEmail": false,
  "subject": "[Programa de Auditorías] Recordatorio: CQI-15 … — vence 30/09/2026",
  "summary": "…",
  "link": "https://…/occurrences/…",
  "card": { "type": "AdaptiveCard", "version": "1.4", "…": "…" },
  "email": { "to": ["…"], "cc": ["…"], "subject": "…", "html": "…", "text": "…" }
}
```

Pasos del flujo (después de la condición del token):
1. **Si `postToChat` = true** → *Post card in a chat or channel*: Flow bot, Chat with Flow bot, Recipient `recipient.email`, Adaptive Card = `card`.
2. **Si `postToChannel` = true** → *Post card in a chat or channel*: Flow bot, **Channel**, elige el equipo y canal de Calidad, Adaptive Card = `card`.
3. **Si `sendEmail` = true** (opcional) → *Office 365 Outlook – Send an email (V2)*: To = `join(email.to, ';')`, CC = `join(email.cc, ';')`, Subject = `email.subject`, Body = `email.html` (Is HTML = Yes). El correo sale de la cuenta dueña del flujo.

Prueba: *Administración → Configuración → «Enviarme un mensaje»*. Con el flujo listo, pon `NOTIFICATIONS_DRY_RUN=false` y reinicia API y worker.

### Copia por correo (opcional)
Llega solo si se cumplen las tres: **Configuración → «Permitir copia por correo»**, la **regla** incluye «copia por correo», y el **usuario** lo activa en *Mi perfil*. Las escalaciones por correo incluyen en copia al responsable, su jefe y, en N3, a los supervisores.

## Producción

```bash
cd frontend && npm ci && npm run build      # audit-web sirve frontend/dist en :5190 (vite preview) y hace proxy de /api → 127.0.0.1:3045
cd backend  && npm ci --omit=dev
pm2 start ecosystem.config.mjs && pm2 save && pm2 startup     # audit-api + audit-worker (una sola instancia) + audit-web; la app queda en http://<servidor>:5190
```
En producción el API no arranca sin `TEAMS_2FA_WEBHOOK_URL`. `GET /api/v1/health` informa `worker: degraded` si el envío diario no corre en 26 h.

### MongoDB como replica set (recomendado)
```
# mongod.cfg
replication:
  replSetName: rs0
```
Reinicia el servicio, ejecuta `mongosh --eval "rs.initiate()"` y agrega `?replicaSet=rs0` a `MONGO_URI`.

## Pruebas

**Cómo funciona la app por rol:** [docs/APP_WORKFLOW_BY_ROLE.md](docs/APP_WORKFLOW_BY_ROLE.md).

**Pruebas manuales por rol:** `npm run seed:demo` + `npm run dev:demo` levantan una base de demostración separada (`<base>_demo`) con usuarios de todos los roles y auditorías en todos los estados. Lista de verificación completa en [docs/GUIA_DE_PRUEBAS.md](docs/GUIA_DE_PRUEBAS.md).

**Pruebas automáticas:**
```bash
cd backend  && npm test     # 83 pruebas: reglas de envío, KPI, parser, flujos HTTP, worker, exportaciones (BD auditsprogram_test, se borra)
cd frontend && npm test     # 31 pruebas: componentes y todas las páginas con datos simulados
```
- `TEST_MONGO_URI` cambia la base de pruebas del backend. La prueba con el Excel real corre si existe `~/Downloads/Programa General de Auditorías.xlsx` (o `PROGRAM_XLSX`).
- En Windows ejecuta las pruebas desde una terminal cuya ruta empiece con `C:\` en mayúscula (con `c:\` Vitest carga módulos duplicados y todo falla con `reading 'config'`).

## Diferencias respecto a la especificación
- Sin SSO de Microsoft ni Microsoft Graph: login propio + registro + 2FA por Teams; todas las notificaciones por flujos de Teams; el correo es una copia opcional enviada por el flujo. Sin sincronización con Entra ID: el jefe directo se asigna en *Usuarios*.
- La URL del flujo vive en `.env` (no cifrada en la base de datos).
- Carpetas `backend/` y `frontend/`; nombres de variables de entorno propios.
- En el Excel real, las filas #3–#13 están en la celda combinada de CSR y se importan como CSR (el apéndice A las lista como Sistema de Calidad); se pueden corregir en la vista previa.
- Febrero 2026: #9 (CQI-15) está en amarillo, así que el cumplimiento **a tiempo** de febrero es 80 % y el **total** 100 % (el Excel mostraba 100 %).
- Si el día de vencimiento cae en día no laborable, el aviso «vence hoy» se envía el día hábil anterior y sustituye al recordatorio de ese día.
