# Preinscripción SENA – Orientación grado 9°

Aplicación web para que los estudiantes elijan entre tres programas de formación, con control de cupos en tiempo real, validación de datos y detección de duplicados.

- **Formulario público:** `index.html`
- **Panel del instructor (con contraseña):** `admin.html`
- **Tecnología:** HTML + CSS + JavaScript en GitHub Pages (gratis) y base de datos Supabase (gratis).

No necesitas saber programar: solo copiar y pegar siguiendo los pasos. Tiempo estimado: 20–30 minutos.

---

## Paso 1. Crear la base de datos en Supabase

1. Entra a <https://supabase.com> y crea una cuenta (puedes usar tu cuenta de GitHub).
2. Pulsa **New project**. Ponle un nombre (ej. `sena-preinscripcion`), crea una contraseña de base de datos (guárdala) y elige la región más cercana (por ejemplo *South America – São Paulo*). Espera a que termine de crearse (1–2 minutos).

## Paso 2. Cargar las tablas y las reglas

1. Abre el archivo `supabase/schema.sql` con el Bloc de notas.
2. **Cambia dos cosas** (están marcadas con `<<<`):
   - El número `35` (cupos por programa), si quieres otro.
   - `instructor@correo.com` por **tu correo real**.
3. Copia **todo** el contenido.
4. En Supabase, menú izquierdo → **SQL Editor** → **New query** → pega → **Run**.
   Debe terminar con "Success". Puedes ejecutarlo más de una vez sin problema.

## Paso 3. Crear tu usuario de instructor

1. Menú izquierdo → **Authentication** → **Users** → **Add user** → *Create new user*.
2. Escribe **el mismo correo** que pusiste en el paso 2 y una contraseña segura. Marca **Auto Confirm User** si aparece.
3. **Importante (seguridad):** en **Authentication → Sign In / Providers** (o *Providers → Email*) desactiva **Allow new users to sign up**, para que nadie más pueda crear usuarios.

> Los nombres de los menús de Supabase pueden cambiar un poco; busca algo equivalente.

## Paso 4. Conectar la página con tu base de datos

1. En Supabase: **Project Settings** (engranaje) → **API** (o **API Keys**).
2. Copia:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - La clave **anon / public** (o *publishable*).
3. Abre `js/config.js` con el Bloc de notas y pega los dos valores entre las comillas. Guarda.

> ⚠️ Pega **solo** la clave `anon`/`public`. **Nunca** la `service_role` ni la contraseña de la base de datos.

## Paso 5. Publicar en GitHub Pages

1. En <https://github.com> crea un repositorio nuevo (ej. `preinscripcion-sena`), **público**.
2. Pulsa **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (`index.html`, `admin.html`, y las carpetas `css`, `js`, `supabase`). Pulsa **Commit changes**.
3. Ve a **Settings → Pages**. En *Build and deployment* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** → **Save**.
4. Espera 1–2 minutos. GitHub te mostrará la dirección, algo como:
   - Estudiantes: `https://TU-USUARIO.github.io/preinscripcion-sena/`
   - Panel: `https://TU-USUARIO.github.io/preinscripcion-sena/admin.html`

## Paso 6. Probar antes de compartir

1. (Opcional) Pega `supabase/datos_de_ejemplo.sql` en el SQL Editor y ejecútalo para ver datos de prueba. **Bórralos antes de abrir las inscripciones reales** (la instrucción está al final de ese archivo).
2. Abre la dirección de estudiantes desde tu celular, registra a alguien de prueba y comprueba que el cupo baje.
3. Entra a `admin.html` con tu correo y contraseña, y verifica que aparezca el registro y que la descarga abra bien en Excel.
4. Borra los registros de prueba: Supabase → **Table Editor** → `inscripciones` → selecciona las filas → borrar. **Los cupos se recuperan solos**, porque se calculan contando los inscritos.

---

## Cómo funciona (resumen)

- Los cupos se leen de la base de datos y se actualizan solos cada 15 segundos.
- Al enviar, **la base de datos** (no el navegador) valida los datos, revisa duplicados y descuenta el cupo en una sola operación protegida. Si 60 personas envían a la vez por los últimos 10 cupos, entran exactamente 10.
- **Duplicados:** un estudiante no puede inscribirse dos veces (ni en el mismo programa ni en otro). Se compara el **celular** y el **correo** (el correo sin importar mayúsculas). Como no se puede consultar la lista desde la página pública (sería filtrar datos de menores), la comprobación ocurre al enviar.
- **Privacidad:** el público no puede leer los datos de nadie; solo tú, con tu usuario, desde el panel. La página de estudiantes no guarda nada en el navegador.

## Cambios comunes

| Quiero… | Qué hago |
|---|---|
| Cambiar los cupos | SQL Editor: `update public.programas set cupos_max = 40;` |
| Cambiar los textos de los programas | Edita `js/programas.js` |
| Cerrar las inscripciones | Pon `cupos_max = 0` con el comando de arriba, o pausa el sitio en Settings → Pages |
| Agregar otro instructor | SQL: `insert into public.instructores (email) values ('otro@correo.com');` y crea su usuario en Authentication |
| Quitar un inscrito | Table Editor → `inscripciones` → borrar la fila |

## Cosas a tener en cuenta

- **Proyecto gratuito de Supabase:** se pausa si pasa una semana sin actividad. Abre el panel un día antes del evento; si está pausado, se reactiva con un botón en Supabase.
- **Cualquiera con el enlace puede inscribirse.** Comparte el enlace solo con los estudiantes. Si temes inscripciones falsas, revisa el panel y borra las que no correspondan.
- **Texto de autorización de datos (Ley 1581):** es un texto general. Confirma con tu coordinación del SENA si necesitan otro formato o la autorización firmada del acudiente por ser menores de edad.
- **Descripciones de los programas:** están redactadas en términos generales; compáralas con las fichas oficiales de cada programa antes de publicar.
- El logo oficial del SENA no está incluido; si quieres, agrégalo al encabezado de `index.html`.
