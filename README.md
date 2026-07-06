# Microservicio CRUD — Node.js + MySQL (+ Frontend Next.js)

Microservicio en **Node.js (Express)** que expone operaciones **CRUD** sobre registros de personas, recibe y envía datos en **JSON**, valida a nivel backend (RFC, correo, código postal, campos obligatorios) y persiste en **MySQL**. Incluye un **frontend sencillo en Next.js (React)**, una **colección de Postman** lista para importar y una **guía de despliegue en AWS** (Lambda + API Gateway + RDS, con Cognito como plus).

## Arquitectura

> Resumen técnico completo (capas, seguridad, decisiones de diseño): **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**

```
Local:
  [Postman]──┐
             ├── JSON/HTTP ──► [API Express :3001] ──► [MySQL 8 (Docker :3307)]
  [Next.js :3000]──┘

AWS (ver docs/DEPLOY_AWS.md):
  Cliente ──► API Gateway (HTTP API) ──► Lambda en VPC (Express + serverless-http) ──► RDS MySQL
                     └─ Cognito como JWT authorizer: /health pública, /api/* exige token
```

La misma app Express corre local (`src/index.js`) y en Lambda (`src/lambda.js` con `serverless-http`), sin duplicar código. El frontend incluye **login con Cognito** (opcional: sin `NEXT_PUBLIC_COGNITO_CLIENT_ID` trabaja sin autenticación, p. ej. contra la API local).

## Stack

- **Backend:** Node.js 20+, Express 4, mysql2 (pool de conexiones), dotenv
- **Base de datos:** MySQL 8 (Docker local / AWS RDS)
- **Frontend:** Next.js 15 + React 19 (TypeScript), login con Amazon Cognito sin SDKs extra
- **Monorepo:** pnpm workspaces
- **Despliegue:** AWS Lambda + API Gateway + Cognito (zip manual o SAM)

## Estructura del proyecto

```
crud-personas/
├── apps/
│   ├── api/                     # Microservicio Node.js (Express)
│   │   ├── sql/schema.sql       # Esquema + datos de ejemplo
│   │   ├── src/
│   │   │   ├── index.js         # Entrada local
│   │   │   ├── lambda.js        # Entrada AWS Lambda (handler: src/lambda.handler)
│   │   │   ├── app.js           # App Express (middlewares, 404, errores)
│   │   │   ├── db.js            # Pool MySQL (mysql2)
│   │   │   ├── routes/          # Endpoints
│   │   │   ├── controllers/     # Lógica HTTP (códigos de estado)
│   │   │   ├── models/          # Acceso a datos (SQL parametrizado)
│   │   │   └── validators/      # Validaciones (RFC, correo, CP)
│   │   └── .env.example
│   └── web/                     # Frontend Next.js (React) + login Cognito (app/auth.ts)
├── .github/workflows/           # CI/CD: deploy del backend con SAM (OIDC, sin access keys)
├── amplify.yml                  # Build del frontend en AWS Amplify Hosting
├── docs/
│   ├── ARQUITECTURA.md          # Resumen técnico de la arquitectura
│   └── DEPLOY_AWS.md            # Guía paso a paso de despliegue en AWS
├── infra/template.yaml          # Alternativa IaC (AWS SAM)
├── postman/                     # Colección Postman lista para importar
├── scripts/package-lambda.ps1   # Genera dist/api-lambda.zip para Lambda
├── docker-compose.yml           # MySQL 8 local (puerto 3307)
└── pnpm-workspace.yaml
```

## Puesta en marcha local

Requisitos: Node.js ≥ 20, pnpm ≥ 9, Docker Desktop (para el MySQL local).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar MySQL (crea el esquema y datos de ejemplo automáticamente)
pnpm db:up

# 3. Configurar variables de la API (los valores por defecto ya apuntan al Docker)
#    Windows:  copy apps\api\.env.example apps\api\.env
#    macOS/Linux:  cp apps/api/.env.example apps/api/.env

# 4. Levantar la API  →  http://localhost:3001
pnpm dev:api

# 5. (En otra terminal) Levantar el frontend  →  http://localhost:3000
pnpm dev:web
```

## Endpoints

Base local: `http://localhost:3001`

| Método | Ruta                 | Operación           | Respuestas            |
| ------ | -------------------- | ------------------- | --------------------- |
| GET    | `/health`            | Salud (servicio+BD) | 200                   |
| POST   | `/api/personas`      | **C**reate          | 201, 400, 409         |
| GET    | `/api/personas`      | **R**ead (todos)    | 200                   |
| GET    | `/api/personas/:id`  | **R**ead (uno)      | 200, 400, 404         |
| PUT    | `/api/personas/:id`  | **U**pdate          | 200, 400, 404, 409    |
| DELETE | `/api/personas/:id`  | **D**elete          | 200, 400, 404         |

### Ejemplo — Crear (POST `/api/personas`)

Petición:

```json
{
  "nombreCompleto": "Juana Pérez López",
  "rfc": "PELJ900101AB1",
  "correo": "juana.perez@ejemplo.com",
  "codigoPostal": "06600"
}
```

Respuesta `201 Created`:

```json
{
  "mensaje": "Registro creado correctamente",
  "data": {
    "id": 3,
    "nombreCompleto": "Juana Pérez López",
    "rfc": "PELJ900101AB1",
    "correo": "juana.perez@ejemplo.com",
    "codigoPostal": "06600",
    "creadoEn": "2026-07-03T18:00:00.000Z",
    "actualizadoEn": "2026-07-03T18:00:00.000Z"
  }
}
```

Respuesta `400 Bad Request` (validación):

```json
{
  "error": "Datos de entrada inválidos",
  "detalles": [
    { "campo": "rfc", "mensaje": "El RFC no tiene un formato válido: 12-13 caracteres con fecha y homoclave (ej. GODE561231GR8)" }
  ]
}
```

## Validaciones (backend)

Implementadas en [apps/api/src/validators/persona.validator.js](apps/api/src/validators/persona.validator.js):

| Campo            | Regla                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nombreCompleto` | Obligatorio; texto de 3 a 255 caracteres                                                                            |
| `rfc`            | Obligatorio; formato SAT: 3-4 letras (incluye Ñ y &) + fecha `AAMMDD` válida + homoclave de 3 caracteres (12-13 en total). Se normaliza a MAYÚSCULAS. **Único** en BD |
| `correo`         | Obligatorio; formato `usuario@dominio.tld`, máximo 254 caracteres. Se normaliza a minúsculas. **Único** en BD        |
| `codigoPostal`   | Obligatorio; cadena de **exactamente 5 dígitos** (se exige cadena para no perder ceros a la izquierda, ej. `"06600"`) |

Regex del RFC: `^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$`

Además: los duplicados de RFC/correo responden `409 Conflict`, un cuerpo que no es JSON válido responde `400`, y si la BD no está disponible responde `503` — siempre en JSON.

## Pruebas con Postman

1. Importa [postman/CRUD-Personas.postman_collection.json](postman/CRUD-Personas.postman_collection.json) (File → Import).
2. La variable `baseUrl` viene como `http://localhost:3001`; para AWS cámbiala por la Invoke URL del API Gateway.
3. Orden sugerido: **Health check → Crear → Listar → Obtener → Actualizar → Eliminar**. La petición "Crear" guarda el `id` en la variable `personaId` automáticamente.
4. La carpeta **"3. Validaciones"** contiene peticiones que deben fallar (400/404/409) para demostrar las validaciones del backend. Todas traen tests automáticos (pestaña *Test Results*).

## Despliegue en AWS (opcional)

Guía completa paso a paso en **[docs/DEPLOY_AWS.md](docs/DEPLOY_AWS.md)**. Resumen:

1. **RDS MySQL** — crear instancia y ejecutar `apps/api/sql/schema.sql`.
2. **Empaquetar** — `pnpm package:lambda` → genera `dist/api-lambda.zip`.
3. **Lambda** — subir el zip, handler `src/lambda.handler`, variables `DB_*`.
4. **API Gateway (HTTP API)** — ruta `ANY /{proxy+}` hacia la Lambda; la Invoke URL queda como URL pública del microservicio.
5. **(PLUS) Cognito** — user pool + JWT authorizer sobre las rutas `/api/*`.

**Alternativa automatizada (recomendada):** [infra/template.yaml](infra/template.yaml) con AWS SAM crea Lambda (en VPC), API Gateway **y Cognito** en un solo `sam deploy`; solo RDS se crea aparte. Ver el camino corto en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md#desplegar-desde-cero).

### CI/CD

| Qué | Quién | Disparador |
| --- | --- | --- |
| Frontend (build + hosting) | AWS Amplify | Push a `main` que toque `apps/web` |
| Backend (`sam deploy`) | GitHub Actions ([deploy-backend.yml](.github/workflows/deploy-backend.yml)) | Push a `main` que toque `apps/api/**` o `infra/**` |

El workflow se autentica en AWS con **OIDC** (asume un rol IAM restringido a este repo y rama; sin access keys guardadas en GitHub). Requiere los secrets `AWS_DEPLOY_ROLE_ARN`, `DB_HOST` y `DB_PASSWORD` — configuración completa en [docs/DEPLOY_AWS.md](docs/DEPLOY_AWS.md#paso-7--opcional-cicd-del-backend-con-github-actions).

## Scripts útiles (raíz del monorepo)

| Comando               | Descripción                                        |
| --------------------- | -------------------------------------------------- |
| `pnpm dev:api`        | API en modo desarrollo (recarga con `node --watch`) |
| `pnpm dev:web`        | Frontend Next.js en desarrollo                     |
| `pnpm build:web`      | Build de producción del frontend                   |
| `pnpm db:up`          | Levanta MySQL en Docker                            |
| `pnpm db:down`        | Detiene MySQL                                      |
| `pnpm package:lambda` | Genera `dist/api-lambda.zip` para AWS Lambda       |
