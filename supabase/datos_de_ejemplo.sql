-- =====================================================================
--  DATOS DE EJEMPLO (solo para probar). Ejecuta schema.sql primero.
--  Todos usan el dominio @ejemplo.com para poder borrarlos fácilmente.
--  ¡BÓRRALOS antes de abrir las inscripciones reales! (ver el final)
-- =====================================================================

select public.registrar_estudiante('Ana María Prueba Uno',  '3000000001', 'ana.prueba1@ejemplo.com',  'teleinformaticos',         true);
select public.registrar_estudiante('Juan Pérez Prueba Dos', '3000000002', 'juan.prueba2@ejemplo.com', 'teleinformaticos',         true);
select public.registrar_estudiante('Laura Gómez Prueba Tres','3000000003','laura.prueba3@ejemplo.com','inteligencia-empresarial', true);
select public.registrar_estudiante('Pedro Ríos Prueba Cuatro','3000000004','pedro.prueba4@ejemplo.com','comercio-exterior',      true);

-- Ver cómo quedaron los cupos:
select * from public.obtener_cupos();

-- ---------------------------------------------------------------------
-- PRUEBAS (ejecuta cada una por separado; el editor muestra el último resultado)
-- ---------------------------------------------------------------------

-- Debe devolver  "codigo": "duplicado"  (mismo teléfono, otro programa):
-- select public.registrar_estudiante('Otra Persona', '3000000001', 'otra@ejemplo.com', 'comercio-exterior', true);

-- Debe devolver  "codigo": "duplicado"  (mismo correo en mayúsculas):
-- select public.registrar_estudiante('Otra Persona', '3000000099', 'ANA.PRUEBA1@EJEMPLO.COM', 'comercio-exterior', true);

-- Debe devolver  "codigo": "datos_invalidos"  (9 dígitos):
-- select public.registrar_estudiante('Carlos Mario Ruiz', '300000009', 'carlos@ejemplo.com', 'teleinformaticos', true);

-- ---------------------------------------------------------------------
-- BORRAR LOS DATOS DE EJEMPLO (quita el "--" de la línea y ejecútala):
-- ---------------------------------------------------------------------
-- delete from public.inscripciones where correo_normalizado like '%@ejemplo.com';
