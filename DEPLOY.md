# Despliegue de GallerApp

El frontend se publica en Vercel. La API Node se ejecuta en Render y conserva
usuarios, eventos, gallos, peleas y apuestas en una tabla PostgreSQL de Supabase.

## 1. Preparar Supabase

1. Crea un proyecto y abre **SQL Editor**.
2. Ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API Keys**, copia la URL del proyecto y crea/copia una
   clave de tipo **Secret key** (`sb_secret_...`). Es privada: se guarda solo como
   `SUPABASE_SECRET_KEY` en Render; nunca en Vercel ni en el código del navegador.

## 2. Desplegar la API en Render

1. Crea un **Web Service** desde `julioluna-00/GallerApp`, rama `main`.
2. Usa `npm ci` como build command y `npm run server` como start command.
   `render.yaml` contiene estos valores y la ruta de health check.
3. Configura `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. El blueprint ya
   permite el dominio de producción `https://gallerapp.vercel.app` en `WEB_ORIGINS`.
4. Render genera `JWT_SECRET` desde el blueprint. No lo cambies después de que
   los usuarios inicien sesión, porque invalida los tokens existentes.
5. Comprueba `https://<servicio>.onrender.com/api/health`.

El plan gratuito de Render puede dormir tras un periodo sin tráfico. La API
puede tardar en responder al primer acceso; Supabase conserva los datos.

## Crear la cuenta administradora

1. Registra tu cuenta desde la página publicada.
2. En Supabase SQL Editor, reemplaza el correo y ejecuta:

```sql
update public.app_state
set value = (
  select jsonb_agg(
    case
      when lower(user_record->>'email') = lower('TU_CORREO')
        then jsonb_set(user_record, '{role}', '"administrador"'::jsonb, true)
      else user_record
    end
  )
  from jsonb_array_elements(value) as users(user_record)
)
where key = 'users';
```

3. Cierra sesión y vuelve a entrar para cargar el rol nuevo.

## 3. Conectar Vercel

En el proyecto de Vercel, agrega `VITE_API_URL` con el origen de Render, por
ejemplo `https://gallerapp-api.onrender.com`, sin `/api` al final. Luego vuelve a
desplegar para que Vite incorpore la variable al frontend.

La recuperación de contraseña por correo necesita un proveedor de correo y
continúa deshabilitada en producción hasta configurarlo.

## Checkout Pro de Mercado Pago (solo Sandbox)

La integración de entrega está limitada a **Sandbox**: los pagos de prueba
pueden añadir créditos demo ficticios para mostrar el flujo de checkout. No
acepta dinero real, no crea saldo canjeable y no incluye retiros. La API exige
que Mercado Pago confirme `live_mode: false` antes de acreditar esos créditos.

1. En [Tus integraciones de Mercado Pago](https://www.mercadopago.com.co/developers/panel/app), crea o abre una aplicación y copia el **Access Token de prueba** (no el de producción).
2. En Render → servicio `gallerapp-api` → **Environment**, agrega:
   - `MP_TEST_ACCESS_TOKEN`: Access Token de prueba.
   - `MP_TEST_WEBHOOK_SECRET`: la clave secreta generada al configurar el webhook de prueba en Mercado Pago.
3. En Mercado Pago → aplicación → **Webhooks**, registra como URL de prueba
   `https://gallerapp-api.onrender.com/api/payments/webhook` y activa el evento
   **Pagos**. Usa la misma clave secreta en Render. Mercado Pago permite separar
   los webhooks de prueba y producción y firma las notificaciones para validar
   su origen ([documentación](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/resources/notifications/webhooks)).
4. Guarda las variables y espera a que Render reinicie el servicio. En la web,
   inicia sesión y abre **Mi perfil → Recargar créditos demo (Sandbox)**. Usa
   una cuenta compradora y una tarjeta de prueba de Mercado Pago; sus
   [instrucciones de compras de prueba](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases)
   explican cómo generar cuentas y simular aprobaciones o rechazos.

La creación del checkout se hace desde el servidor con paquetes y precios
fijos. La firma del webhook se valida y el pago se vuelve a consultar con la API
de Mercado Pago; la URL de retorno del navegador por sí sola nunca acredita el
saldo. No guardes estas credenciales en Vercel, en GitHub ni en el código.
