# Despliegue en AWS — Lambda + API Gateway + RDS MySQL (+ Cognito)

Esta guía publica el microservicio con la arquitectura:

```
Cliente (Postman / Next.js)
        │ HTTPS
        ▼
API Gateway (HTTP API)  ── (PLUS) Cognito JWT authorizer
        │
        ▼
AWS Lambda (Node.js 22, Express + serverless-http)
        │ TCP 3306
        ▼
RDS MySQL 8 (base: crud_personas)
```

> Usa la **misma región** para todos los recursos (ej. `us-east-1`). Los nombres usados abajo son sugerencias.

---

## Paso 1 — Base de datos: RDS MySQL

1. Consola AWS → **RDS** → *Create database*.
2. Opciones:
   - *Engine:* **MySQL 8.x** · *Templates:* **Free tier** (o Dev/Test).
   - *DB instance identifier:* `crud-personas-db`.
   - *Master username:* `admin` · *Master password:* (guárdala, será `DB_PASSWORD`).
   - *Instance:* `db.t4g.micro` o `db.t3.micro` · *Storage:* 20 GB gp3.
3. **Conectividad** (elige según el objetivo):
   - **Demo rápida:** *Public access: **Yes***. En el Security Group de la BD agrega una regla de entrada `MySQL/Aurora (3306)` desde **tu IP** (para cargar el esquema) y luego otra desde el Security Group de la Lambda (o temporalmente `0.0.0.0/0` — solo para la demo, no lo dejes así).
   - **Producción:** *Public access: No* y la Lambda dentro de la misma VPC (ver Paso 3.6).
4. Espera el estado **Available** y copia el **Endpoint** (ej. `crud-personas-db.xxxx.us-east-1.rds.amazonaws.com`).
5. **Crear el esquema:** conéctate con MySQL Workbench / DBeaver usando el endpoint, usuario y contraseña, y ejecuta el contenido de [`apps/api/sql/schema.sql`](../apps/api/sql/schema.sql). Con CLI:

   ```bash
   mysql -h <ENDPOINT-RDS> -u admin -p < apps/api/sql/schema.sql
   ```

---

## Paso 2 — Empaquetar el código para Lambda

Desde la raíz del repo (Windows):

```powershell
pnpm package:lambda
```

Genera `dist/api-lambda.zip` (código `src/` + `node_modules` de producción). En macOS/Linux el equivalente es:

```bash
mkdir -p dist/lambda && cp -r apps/api/src apps/api/package.json dist/lambda/
cd dist/lambda && npm install --omit=dev --no-package-lock && zip -r ../api-lambda.zip . && cd ../..
```

---

## Paso 3 — Lambda (aquí se carga el código)

1. Consola → **Lambda** → *Create function* → *Author from scratch*:
   - *Name:* `api-personas` · *Runtime:* **Node.js 22.x** · *Architecture:* x86_64.
2. *Code* → **Upload from → .zip file** → sube `dist/api-lambda.zip`.
3. *Runtime settings* → **Handler: `src/lambda.handler`** (importante, no es el default).
4. *Configuration → Environment variables:*

   | Clave          | Valor                              |
   | -------------- | ---------------------------------- |
   | `DB_HOST`      | endpoint de RDS                    |
   | `DB_PORT`      | `3306`                             |
   | `DB_USER`      | `admin`                            |
   | `DB_PASSWORD`  | tu contraseña                      |
   | `DB_NAME`      | `crud_personas`                    |
   | `DB_POOL_SIZE` | `2`                                |

5. *Configuration → General configuration:* **Timeout 15 s**, **Memory 256 MB**.
6. **Solo si RDS es privada:** *Configuration → VPC* → misma VPC de RDS, 2+ subnets y un Security Group para la Lambda; en el SG de RDS permite `3306` **desde el SG de la Lambda**. (Nota: dentro de una VPC la Lambda pierde salida a internet salvo que agregues NAT Gateway; para esta API no hace falta internet.)

---

## Paso 4 — API Gateway (routing de los métodos)

1. Consola → **API Gateway** → *Create API* → **HTTP API** → *Build*.
2. *Add integration* → **Lambda** → selecciona `api-personas`. *API name:* `api-personas`.
3. **Rutas** — dos opciones (equivalentes para esta app):
   - **Simple (recomendada):** una sola ruta `ANY /{proxy+}` → integración Lambda. Express resuelve internamente GET/POST/PUT/DELETE.
   - **Explícita (como en el requerimiento):** crea `GET /health`, `GET /api/personas`, `POST /api/personas`, `GET /api/personas/{id}`, `PUT /api/personas/{id}`, `DELETE /api/personas/{id}` — todas hacia la misma integración Lambda.
4. *Stage:* `$default` con **auto-deploy**.
5. **CORS** (necesario si el frontend consume directo desde el navegador): *CORS* → `Access-Control-Allow-Origin: *` (o el dominio del front), *Methods:* `GET,POST,PUT,DELETE,OPTIONS`, *Headers:* `content-type,authorization`.
6. Copia la **Invoke URL** (ej. `https://ab12cd34.execute-api.us-east-1.amazonaws.com`).
7. **Prueba:** `GET <InvokeURL>/health` debe responder `{"servicio":"api-personas","estado":"ok","baseDatos":"conectada"}`. En Postman cambia la variable `baseUrl` de la colección por la Invoke URL y corre todo el CRUD.

> Si `baseDatos` sale `"sin conexión"`, revisa Security Groups (3306 abierto para la Lambda), las variables `DB_*` y la config de VPC.

---

## Paso 5 — (PLUS) Cognito: acceso privado con login

1. Consola → **Cognito** → *User pools* → *Create user pool*:
   - Sign-in por **email**. Crea un **App client** tipo *Public client / SPA* (sin secret).
   - Anota: `User pool ID` (ej. `us-east-1_AbCdEf`) y `Client ID`.
   - Crea un usuario de prueba (o habilita self-registration).
2. API Gateway → tu API → **Authorization** → *Create authorizer* → **JWT**:
   - *Issuer URL:* `https://cognito-idp.<región>.amazonaws.com/<UserPoolID>`
   - *Audience:* el `Client ID`.
3. **Adjunta el authorizer a las rutas** `/api/...` (puedes dejar `/health` pública).
4. Obtener un token para probar:
   - Activa el **Hosted UI / Login pages** del app client, inicia sesión y toma el `id_token` de la URL de redirección, **o**
   - CLI: `aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id <ClientID> --auth-parameters USERNAME=<email>,PASSWORD=<pass>` (requiere habilitar ese flow en el app client).
5. En Postman agrega el header `Authorization: Bearer <id_token>`. Sin token las rutas protegidas responden `401 Unauthorized`.
6. En el frontend se integraría con Amplify Auth u `oidc-client-ts`, enviando el token en cada `fetch` (fuera del alcance de esta demo).

---

## Paso 6 — (Opcional) Publicar el frontend

- **AWS Amplify Hosting** (o Vercel): conecta el repo de GitHub, *app root:* `apps/web`, build `pnpm install && pnpm build`, y define la variable **`NEXT_PUBLIC_API_URL` = Invoke URL** del API Gateway.

---

## Alternativa automatizada — AWS SAM

Con [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) instalado:

```bash
pnpm package:lambda   # deja el código en dist/lambda/
sam deploy --guided --template infra/template.yaml \
  --parameter-overrides DbHost=<endpoint-rds> DbUser=admin DbPassword=<pass>
```

El output `ApiUrl` es la URL pública. (RDS se crea aparte, Paso 1.)

---

## Costos y limpieza

- Free tier cubre lo básico (Lambda 1M invocaciones/mes, API Gateway 1M, RDS 750 h de micro el primer año). **RDS es lo que genera costo si se queda encendida**: al terminar la revisión, elimina la instancia RDS, la función Lambda, el API y el user pool.
