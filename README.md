# Programa General de Auditorías

Web app de Calidad — ZF El Salto que reemplaza el calendario anual en Excel y los recordatorios manuales.
Especificación: `Programa_General_Auditorias_SPEC.md` (no versionado).

| | |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind 4, TanStack Query, react-hook-form + zod (`frontend/`, puerto **5190**) |
| Backend | Node 22+ / Express 5 + Mongoose 9, zod, pino (`backend/`, puerto **3045**, base `/api/v1`) |
| Base de datos | MongoDB 7+ (replica set recomendado: las importaciones y reasignaciones usan transacciones) |

## Estado: Fase 1 (núcleo del programa)

Hecho:
- Inicio de sesión propio y **auto-registro** (solo dominios de `ALLOWED_EMAIL_DOMAINS`, entran como VIEWER) con **2FA por Teams** en cada inicio de sesión. Recuperación de contraseña con código por Teams.
- Catálogo de auditorías (CRUD) y fechas programadas (BR-01…05).
- Ciclo completo de una fecha: registrar realizada con evidencia → validar/rechazar → reprogramar (solicitud/aprobación o directa) → cancelar / no realizada / reabrir, con la máquina de estados de la sección 6.
- Evidencia: subida (tipo por MIME y extensión, 20 MB), descarga autenticada, borrado lógico.
- Matriz anual con colores del Excel, filas resumen y KPI con **N/A** (no 0 %) cuando nada es exigible.
- Inicio por rol (responsable, gerente, admin), Mis auditorías, cola de validaciones.
- Importación del Excel actual (vista previa → correcciones → confirmación), incluida su tabla de revisiones como bitácora histórica.
- Usuarios (roles, supervisor, jefe directo, reasignación BR-50/51), grupos, días no laborables, bitácora de cambios inalterable.

Pendiente (fases 2–4): worker de recordatorios y escalaciones, correos (Graph/SMTP), reglas de notificación, reportes y exportación Excel/PDF, tarjetas de Teams y resumen semanal, cambio de año, página de configuración.

## Puesta en marcha (desarrollo)

```bash
# Backend
cd backend
cp .env.example .env        # ajusta MONGO_URI, JWT_SECRET (≥32 caracteres), ALLOWED_EMAIL_DOMAINS
npm install
npm run create-admin -- --email nombre.apellido@zf.com --name "Nombre Apellido" --password "Clave-segura-2026"
npm run seed                # opcional: grupos del programa 2026 + usuarios demo (no producción)
npm run dev                 # http://localhost:3045/api/v1/health

# Frontend (otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5190  (proxy /api → 3045)
```

Sin `TEAMS_2FA_WEBHOOK_URL`, en desarrollo el código de 2FA se imprime en la consola del backend (`[DEV 2FA] LOGIN code for …`). En producción el backend no arranca sin esa URL.

### Importar el Excel 2026
1. Los responsables se registran primero (o el admin los crea), para poder asignarlos.
2. *Administración → Importar Excel*, año 2026, sube el archivo.
3. «Crear grupos que no existen», asigna responsables (individualmente o en bloque) y el grupo interno de las auditorías externas (DQS, SGS).
4. Confirma cuando no queden problemas bloqueantes.

### MongoDB como replica set (recomendado)
Sin replica set la app funciona, pero las escrituras de varios documentos no son atómicas (se registra un aviso al arrancar). Para un nodo local:
```
# mongod.cfg
replication:
  replSetName: rs0
```
Reinicia el servicio MongoDB, ejecuta `mongosh --eval "rs.initiate()"` y agrega `?replicaSet=rs0` a `MONGO_URI`.

## 2FA por Teams: contrato del flujo (Power Automate / Teams Workflows)

El backend llama al disparador HTTP del flujo en cada inicio de sesión y en cada recuperación de contraseña:

```
POST {TEAMS_2FA_WEBHOOK_URL}
Content-Type: application/json
x-api-key: {TEAMS_2FA_API_TOKEN}

{
  "email": "nombre.apellido@zf.com",
  "name": "Nombre Apellido",
  "code": "483920",
  "purpose": "LOGIN",            // o "PASSWORD_RESET"
  "expiresInMinutes": 5,
  "appName": "Programa General de Auditorías"
}
```

El flujo debe: (1) validar que el encabezado `x-api-key` sea igual al token configurado (si no, responder 401), (2) enviar el código por chat de Teams a `email`, (3) responder 2xx. Cualquier otra respuesta se muestra al usuario como «No se pudo enviar el código por Teams».
Reglas: código de 6 dígitos, vigencia `TWO_FACTOR_CODE_TTL_MINUTES` (5), máximo `TWO_FACTOR_MAX_ATTEMPTS` (5) intentos, reenvío cada 60 s.

## Pruebas

```bash
cd backend  && npm test     # unitarias + integración (usa la BD mongodb://127.0.0.1:27017/auditsprogram_test, la borra al terminar)
cd frontend && npm test     # componentes + todas las páginas con datos simulados
```
- `TEST_MONGO_URI` cambia la base de pruebas del backend.
- La prueba del parser con el Excel real se ejecuta si existe `~/Downloads/Programa General de Auditorías.xlsx` (o `PROGRAM_XLSX`); si no, se omite.
- En Windows, ejecuta las pruebas desde una terminal cuya ruta empiece con `C:\` en mayúscula: con `c:\` Vitest carga módulos duplicados y todas las suites fallan con `Cannot read properties of undefined (reading 'config')`.

## Diferencias respecto a la especificación
- Sin SSO de Microsoft: login propio + registro + 2FA por Teams (decisión 2026-11-22).
- Carpetas `backend/` y `frontend/` (no `server/`, `client/`); nombres de variables de entorno propios (`CLIENT_ORIGINS`, `LOCAL_STORAGE_PATH`, `GRAPH_MAILBOX`…).
- En el Excel real, las filas #3–#13 están dentro de la celda combinada de CSR; se importan como CSR (el apéndice A las lista como Sistema de Calidad). Se pueden corregir en la vista previa.
- Febrero 2026: la auditoría #9 (CQI-15) está en amarillo (fuera de tiempo), por lo que el cumplimiento **a tiempo** de febrero es 80 % y el **total** 100 % (el Excel mostraba 100 %).
