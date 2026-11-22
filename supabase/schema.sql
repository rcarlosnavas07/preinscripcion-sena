-- =====================================================================
--  PREINSCRIPCIÓN SENA – ORIENTACIÓN GRADO 9°
--
--  CÓMO USAR: en Supabase abre "SQL Editor", pega TODO este archivo
--  y pulsa "Run". Se puede ejecutar varias veces sin dañar nada.
--
--  ANTES DE EJECUTAR cambia estas dos cosas (busca las marcas  <<<):
--    1) El número de cupos por programa (línea con "35").
--    2) Tu correo de instructor (el mismo con el que entrarás al panel).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) TABLAS
-- ---------------------------------------------------------------------

-- Programas de formación y su límite de cupos.
create table if not exists public.programas (
  id         text primary key,
  nombre     text not null,
  cupos_max  integer not null check (cupos_max >= 0),
  orden      integer not null
);

-- Estudiantes inscritos. Los cupos disponibles NO se guardan: se calculan
-- como (cupos_max - inscritos). Así nunca se desajustan: si borras un
-- inscrito desde Supabase, ese cupo vuelve a quedar libre automáticamente.
create table if not exists public.inscripciones (
  id                  bigint generated always as identity primary key,
  programa_id         text not null references public.programas (id),
  nombre_completo     text not null,
  nombre_normalizado  text not null,   -- minúsculas, sin tildes, sin espacios dobles
  telefono            text not null,
  correo              text not null,
  correo_normalizado  text not null,   -- minúsculas
  acepta_datos        boolean not null default true,
  creado_en           timestamptz not null default now()
);

-- Candados de la propia base de datos contra duplicados: aunque dos personas
-- envíen el formulario al mismo tiempo, un teléfono o un correo no se repite.
create unique index if not exists inscripciones_telefono_uq
  on public.inscripciones (telefono);
create unique index if not exists inscripciones_correo_uq
  on public.inscripciones (correo_normalizado);

-- Correos de las personas autorizadas a ver el panel del instructor.
create table if not exists public.instructores (
  email text primary key
);


-- ---------------------------------------------------------------------
-- 2) DATOS INICIALES
-- ---------------------------------------------------------------------

insert into public.programas (id, nombre, orden, cupos_max)
select v.id, v.nombre, v.orden,
       35                                    -- <<< CAMBIA AQUÍ los cupos por programa
from (values
  ('teleinformaticos',         'Sistemas Teleinformáticos',                     1),
  ('inteligencia-empresarial', 'Asistencia para la Inteligencia Empresarial',   2),
  ('comercio-exterior',        'Operaciones de Comercio Exterior',              3)
) as v (id, nombre, orden)
on conflict (id) do update
  set nombre    = excluded.nombre,
      orden     = excluded.orden,
      cupos_max = excluded.cupos_max;

insert into public.instructores (email)
values (lower('rcarlosnavas.nr@gmail.com'))      -- <<< CAMBIA por TU correo
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 3) FUNCIONES
-- ---------------------------------------------------------------------

-- ¿El usuario que inició sesión es un instructor autorizado?
create or replace function public.es_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instructores i
    where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Cupos por programa. Es lo único que ve el público (sin datos personales).
create or replace function public.obtener_cupos()
returns table (
  programa_id     text,
  nombre_programa text,
  cupos_max       integer,
  ocupados        integer,
  disponibles     integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.nombre,
         p.cupos_max,
         count(i.id)::integer,
         greatest(p.cupos_max - count(i.id)::integer, 0)
  from public.programas p
  left join public.inscripciones i on i.programa_id = p.id
  group by p.id, p.nombre, p.cupos_max, p.orden
  order by p.orden;
$$;

-- Registro de un estudiante. TODO ocurre dentro de una sola transacción:
--   1. valida los datos (también en el servidor, no solo en el navegador)
--   2. bloquea la fila del programa para que dos envíos simultáneos
--      se pongan en fila (así nunca se pasan de los cupos)
--   3. revisa duplicados y cupos
--   4. guarda
create or replace function public.registrar_estudiante(
  p_nombre   text,
  p_telefono text,
  p_correo   text,
  p_programa text,
  p_acepta   boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre       text;
  v_nombre_norm  text;
  v_tel          text;
  v_correo       text;
  v_prog_nombre  text;
  v_cupos_max    integer;
  v_ocupados     integer;
begin
  -- Limpieza: quita espacios sobrantes y pasa a minúsculas donde corresponde.
  v_nombre := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_tel    := btrim(coalesce(p_telefono, ''));
  v_correo := lower(btrim(coalesce(p_correo, '')));

  -- Validaciones de datos
  if v_nombre !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)+$'
     or length(v_nombre) > 100 then
    return json_build_object('ok', false, 'codigo', 'datos_invalidos',
      'mensaje', 'El nombre debe tener al menos dos palabras y solo letras.');
  end if;

  if v_tel !~ '^3[0-9]{9}$' then
    return json_build_object('ok', false, 'codigo', 'datos_invalidos',
      'mensaje', 'El celular debe tener 10 dígitos y empezar por 3.');
  end if;

  if v_correo !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
     or length(v_correo) > 120 then
    return json_build_object('ok', false, 'codigo', 'datos_invalidos',
      'mensaje', 'El correo electrónico no es válido.');
  end if;

  if p_acepta is distinct from true then
    return json_build_object('ok', false, 'codigo', 'datos_invalidos',
      'mensaje', 'Debes aceptar el tratamiento de datos personales.');
  end if;

  -- Nombre normalizado para comparar: sin tildes, minúsculas, espacios simples.
  v_nombre_norm := lower(translate(v_nombre,
                     'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'));

  -- Bloquea la fila del programa hasta terminar (evita carreras por el último cupo).
  select p.nombre, p.cupos_max
    into v_prog_nombre, v_cupos_max
  from public.programas p
  where p.id = p_programa
  for update;

  if not found then
    return json_build_object('ok', false, 'codigo', 'programa_invalido',
      'mensaje', 'El programa seleccionado no existe.');
  end if;

  -- ¿Ya existe este estudiante en CUALQUIER programa?
  -- Se compara el teléfono y el correo normalizados. Como el teléfono por sí
  -- solo ya cuenta como duplicado, también queda cubierto el caso
  -- "mismo nombre + mismo teléfono".
  if exists (
    select 1
    from public.inscripciones i
    where i.telefono = v_tel
       or i.correo_normalizado = v_correo
  ) then
    return json_build_object('ok', false, 'codigo', 'duplicado',
      'mensaje', 'Este estudiante ya cuenta con un registro previo en un programa de formación.');
  end if;

  -- ¿Quedan cupos?
  select count(*)::integer
    into v_ocupados
  from public.inscripciones i
  where i.programa_id = p_programa;

  if v_ocupados >= v_cupos_max then
    return json_build_object('ok', false, 'codigo', 'sin_cupos',
      'mensaje', 'Este programa acaba de quedar sin cupos. Por favor elige otro.');
  end if;

  -- Guardar. Si dos personas con el mismo teléfono/correo llegan a la vez a
  -- programas distintos, los índices únicos detienen al segundo.
  begin
    insert into public.inscripciones
      (programa_id, nombre_completo, nombre_normalizado, telefono,
       correo, correo_normalizado, acepta_datos)
    values
      (p_programa, v_nombre, v_nombre_norm, v_tel,
       v_correo, v_correo, true);
  exception when unique_violation then
    return json_build_object('ok', false, 'codigo', 'duplicado',
      'mensaje', 'Este estudiante ya cuenta con un registro previo en un programa de formación.');
  end;

  return json_build_object('ok', true, 'codigo', 'ok',
    'mensaje', 'Inscripción registrada.',
    'nombre', v_nombre,
    'programa', v_prog_nombre);
end;
$$;


-- ---------------------------------------------------------------------
-- 4) SEGURIDAD
--    El público NO puede leer ni escribir las tablas directamente.
--    Solo puede llamar a obtener_cupos() y registrar_estudiante().
--    Solo el instructor autorizado puede leer la lista de inscritos.
-- ---------------------------------------------------------------------

alter table public.programas     enable row level security;
alter table public.inscripciones enable row level security;
alter table public.instructores  enable row level security;

revoke all on public.programas     from anon, authenticated;
revoke all on public.inscripciones from anon, authenticated;
revoke all on public.instructores  from anon, authenticated;
grant select on public.inscripciones to authenticated;

drop policy if exists "instructor ve inscripciones" on public.inscripciones;
create policy "instructor ve inscripciones"
  on public.inscripciones
  for select
  to authenticated
  using (public.es_instructor());

revoke all on function public.obtener_cupos()        from public, anon, authenticated;
revoke all on function public.registrar_estudiante(text, text, text, text, boolean)
                                                     from public, anon, authenticated;
revoke all on function public.es_instructor()        from public, anon, authenticated;

grant execute on function public.obtener_cupos()     to anon, authenticated;
grant execute on function public.registrar_estudiante(text, text, text, text, boolean)
                                                     to anon, authenticated;
grant execute on function public.es_instructor()     to authenticated;
