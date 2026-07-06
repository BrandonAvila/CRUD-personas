# Arquitectura — Microservicio CRUD de Personas

Resumen técnico del proyecto para su revisión. Cómo ejecutarlo: ver [§ Ejecución](#ejecución).

## Visión general

Monorepo (**pnpm workspaces**) con dos aplicaciones y su infraestructura:

| Pieza | Tecnología | Responsabilidad |
| --- | --- | --- |
| `apps/api` | Node.js 20+, Express 4, mysql2 | Microservicio CRUD de personas (JSON) |
| `apps/web` | Next.js 15, React 19, TypeScript | Frontend de una página con login (Cognito) |
| `infra/template.yaml` | AWS SAM (CloudFormation) | Lambda + API Gateway + Cognito como IaC |
| `docker-compose.yml` | MySQL 8 | Base de datos local |

## Diagrama

```
LOCAL                                        AWS
─────                                        ───
[Postman]──┐                                 Amplify Hosting (us-east-2) — frontend Next.js
           ├─► API Express :3001                   │ sirve la SPA; redeploy automático con cada push a main
[Next.js   │        │                              ▼
 :3000]────┘        ▼                        [Navegador] ── HTTPS + JWT (Authorization: Bearer)
              MySQL 8 (Docker :3307)               ▼
                                             API Gateway (HTTP API, us-east-1)
                                               ├─ GET /health ............. pública
                                               ├─ OPTIONS /api/* .......... pública (preflight CORS)
                                               └─ ANY /api/* .... Cognito JWT authorizer
                                                    │
                                                    ▼
                                             Lambda api-personas (Express + serverless-http)
                                                    │ dentro de la VPC, TCP 3306
                                                    ▼
                                             RDS MySQL 8 (crud-personas-db)
```

**La misma app Express corre en ambos entornos**: `src/index.js` la levanta como servidor local y `src/lambda.js` la envuelve con `serverless-http` para Lambda. Cero duplicación de lógica.

## Capas del microservicio

Petición → `routes` → `controllers` → `models` → MySQL, con validación previa:

- **`validators/`** — reglas puras sin dependencias: RFC formato SAT (regex con fecha AAMMDD válida y homoclave), correo, código postal de 5 dígitos como cadena. Devuelve lista de errores por campo.
- **`controllers/`** — traduce resultados a HTTP: 201 al crear, 400 validación/id no numérico/JSON malformado, 404 inexistente, 409 duplicados (detectados por los índices únicos de MySQL, no por consulta previa — evita condiciones de carrera), 503 sin BD, 500 resto. Siempre JSON.
- **`models/`** — SQL **100 % parametrizado** (placeholders `?` de mysql2) sobre un pool de conexiones compartido; sin riesgo de inyección SQL.

La tabla `personas` (`sql/schema.sql`) usa utf8mb4, índices únicos en `rfc` y `correo`, y timestamps automáticos. El mismo archivo inicializa el Docker local y el RDS.

## Autenticación (Cognito)

- **Backend**: el template SAM crea un *user pool*, un *app client* SPA (sin secret) y un **JWT authorizer** en el API Gateway. `/health` es pública; todo `/api/*` responde `401` sin un token válido. La Lambda no valida tokens: lo hace el gateway antes de invocarla.
- **Preflight CORS**: los navegadores envían `OPTIONS` sin token antes de cada petición; por eso existe una ruta explícita `OPTIONS /api/{proxy+}` **sin authorizer** que llega al middleware `cors()` de Express (responde 204 con los headers). Sin ella, el preflight caería en el authorizer del `ANY` y el navegador bloquearía todas las llamadas.
- **Frontend** (`apps/web/app/auth.ts`): habla con el endpoint `cognito-idp` directamente vía `fetch` (protocolo JSON con header `X-Amz-Target`, el mismo de la AWS CLI) — **sin SDKs ni dependencias extra**. Maneja login (`USER_PASSWORD_AUTH`), sesión en `sessionStorage`, renovación automática del token (flujo `REFRESH_TOKEN_AUTH`, anticipada y ante 401) y cierre de sesión.
- **Modo dual**: si `NEXT_PUBLIC_COGNITO_CLIENT_ID` está vacío, el frontend opera sin login (para desarrollo local contra la API sin proteger).

## Seguridad

- Inyección SQL: imposible por SQL parametrizado; el `:id` de la URL se valida con regex antes de tocar la BD.
- La BD en AWS **no está expuesta a internet**: su security group solo acepta 3306 desde el security group de la Lambda (que corre dentro de la VPC) y desde la IP del desarrollador (para cargas de esquema).
- Errores sin fugas: el cliente nunca recibe stack traces ni mensajes internos de MySQL.
- Secretos fuera del repo: `.env`, `.env.local` y `infra/.env.aws.local` (credenciales del despliegue) están en `.gitignore`.
- XSS: React escapa todo el contenido; no se usa `dangerouslySetInnerHTML`.

## Decisiones de diseño

1. **Un solo código, dos entradas** (local/Lambda): elimina la divergencia entre lo que se prueba local y lo que corre en AWS.
2. **RDS fuera del stack SAM**: la BD tiene ciclo de vida propio (y costo); así se puede crear/destruir la aplicación sin tocar los datos.
3. **409 por índices únicos** en lugar de "consultar y luego insertar": atómico y a prueba de concurrencia.
4. **Frontend sin dependencias de auth**: para un login simple, llamar a Cognito con `fetch` evita ~200 KB de SDK y mantiene el proyecto legible.
5. **Código postal como cadena**: preserva ceros a la izquierda (`06600`).

## Ejecución

### Local (todo en tu máquina)

Requisitos: Node.js ≥ 20, pnpm ≥ 9, Docker Desktop.

```bash
pnpm install
pnpm db:up                                   # MySQL 8 en Docker (puerto 3307) + esquema + datos de ejemplo
# copiar apps/api/.env.example → apps/api/.env  (los defaults ya apuntan al Docker)
pnpm dev:api                                 # API      → http://localhost:3001
pnpm dev:web                                 # Frontend → http://localhost:3000   (otra terminal)
```

Sin `NEXT_PUBLIC_COGNITO_CLIENT_ID` configurado no se pide login (la API local no exige token).

### Contra el despliegue en AWS

En `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=<Invoke URL del API Gateway>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<output UserPoolClientId del stack>
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

`pnpm dev:web` mostrará la pantalla de login; se entra con un usuario del user pool.

### Postman

Importar `postman/CRUD-Personas.postman_collection.json`. Con la API local funciona directo; contra AWS, cambiar `baseUrl` por la Invoke URL y agregar el header `Authorization: Bearer <IdToken>` (token obtenible con `aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH ...` o iniciando sesión en el frontend). La carpeta *Validaciones* demuestra los 400/404/409.

### Desplegar desde cero

Guía completa en [DEPLOY_AWS.md](DEPLOY_AWS.md). Camino corto (RDS ya creada y con esquema):

```bash
pnpm package:lambda
sam deploy --template infra/template.yaml --stack-name crud-personas --resolve-s3 \
  --capabilities CAPABILITY_IAM --parameter-overrides "DbHost=<endpoint-rds> DbPassword=<pass>"
```

Outputs del stack: `ApiUrl`, `UserPoolId`, `UserPoolClientId`.
