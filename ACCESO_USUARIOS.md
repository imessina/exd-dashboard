# Alta de usuarios sin correo

Describe el alta con contraseña temporal, su cambio obligatorio y las comprobaciones locales del flujo.

## Uso

1. Un superadministrador abre **Usuarios → Nuevo usuario**.
2. Selecciona **Contraseña temporal (sin correo)** y completa los datos y una contraseña de 8 a 128 caracteres. También se aplican los requisitos de contraseña configurados en Supabase.
3. Comparte el correo de acceso y la contraseña temporal con el destinatario por un canal seguro.
4. En el primer ingreso, Talentia muestra el cambio obligatorio. El usuario introduce la contraseña temporal y confirma una nueva, distinta de la anterior.
5. Después de guardarla, vuelve a iniciar sesión con la nueva contraseña.

La opción **Invitación por correo** sigue disponible. No se alteran cuentas existentes ni se crea ningún usuario automáticamente al desplegar el código.

## Implementación

- El backend usa `POST /auth/v1/admin/users` con `email_confirm=true`: el superadministrador asume la verificación del destinatario y no se envía invitación. La clave administrativa permanece en el servidor.
- El requisito se guarda en `app_metadata.must_change_password`, que el usuario no puede modificar mediante sus metadatos personales.
- Login y ProtectedRoute redirigen al cambio obligatorio; `require_supabase_user` rechaza operaciones autenticadas mientras esté pendiente.
- `POST /api/usuarios/password-inicial` valida la sesión, la existencia de una cuenta activa, la contraseña temporal mediante reautenticación y que la nueva sea distinta. Solo actualiza al usuario de la sesión, nunca un identificador enviado por el navegador.
- Contraseña y bandera se actualizan en una misma llamada administrativa. No se registra ni devuelve la contraseña. Los modelos usan SecretStr y los errores de validación omiten los valores recibidos.
- La contraseña temporal solo vive en el formulario hasta el alta o cierre; no se escribe en almacenamiento del navegador ni en la tabla de perfiles.
- El cliente cierra sesión y elimina la caché del perfil después de cambiar la contraseña.

## Alcance de los controles

El cambio obligatorio protege la navegación y los endpoints que validan usuarios de Supabase. El proyecto conserva endpoints de lectura protegidos únicamente por API key, además de acceso directo a la tabla de usuarios mediante Supabase. Sus políticas de acceso no se modifican aquí: para imponer esta restricción también sobre todas las lecturas directas deben revisarse esas rutas y las políticas RLS. El bloqueo visual no sustituye esos controles.

## Comprobación

Desde `backend`: `.venv/Scripts/python.exe -m unittest discover -s tests -v`.
Desde `frontend`: `node --test tests/*.test.mjs` y `npm run build`.

Las pruebas simulan Auth y la base de datos: no crean cuentas reales ni envían correos. Para probar manualmente, crear una cuenta de prueba desde Usuarios, verificar la redirección al abrir directamente `/personas`, rechazar la contraseña repetida y comprobar el ingreso con la nueva.

Publicar frontend y backend juntos. No requiere migración de columnas; utiliza los metadatos existentes de Supabase Auth.

Referencias oficiales: [crear usuarios sin invitación](https://supabase.com/docs/reference/javascript/auth-admin-createuser) y [actualización administrativa de contraseña y app_metadata](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
