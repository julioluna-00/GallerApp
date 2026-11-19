# Despliegue de GallerApp

El frontend se publica en Vercel. La API Node se ejecuta en Render y conserva
usuarios, eventos, gallos, peleas y apuestas en una tabla PostgreSQL de Supabase.

## 1. Preparar Supabase

1. Crea un proyecto y abre **SQL Editor**.
2. Ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API**, copia la URL del proyecto y la clave `service_role`.
   La clave `service_role` es privada: se guarda solo como variable de entorno en
   Render; nunca en Vercel ni en el código del navegador.

## 2. Desplegar la API en Render

1. Crea un **Web Service** desde `julioluna-00/GallerApp`, rama `main`.
2. Usa `npm ci` como build command y `npm run server` como start command.
   `render.yaml` contiene estos valores y la ruta de health check.
3. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. El blueprint ya
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
