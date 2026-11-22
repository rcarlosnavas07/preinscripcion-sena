// Validaciones del formulario. Cada función devuelve "" si el dato es
// correcto, o el mensaje de error en español si no lo es.
// (El servidor repite estas mismas reglas en schema.sql.)
(function () {
  "use strict";

  var LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
  var RE_SOLO_LETRAS = new RegExp("^[" + LETRAS + " ]+$");
  var RE_NOMBRE = new RegExp("^[" + LETRAS + "]+( [" + LETRAS + "]+)+$");
  var RE_TELEFONO = /^3\d{9}$/;
  var RE_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  // Quita espacios al inicio/final y reduce los dobles a uno.
  function limpiarNombre(valor) {
    return String(valor || "").replace(/\s+/g, " ").trim();
  }

  function validarNombre(valor) {
    var n = limpiarNombre(valor);
    if (!n) return "Escribe tu nombre completo.";
    if (!RE_SOLO_LETRAS.test(n)) return "Usa solo letras y espacios (sin números ni símbolos).";
    if (!RE_NOMBRE.test(n)) return "Escribe tu nombre y apellido (mínimo dos palabras).";
    if (n.length > 100) return "El nombre es demasiado largo.";
    return "";
  }

  function validarTelefono(valor) {
    var t = String(valor || "").trim();
    if (!t) return "Escribe tu número de celular.";
    if (!/^\d+$/.test(t)) return "El celular solo puede tener números.";
    if (t.length !== 10) return "El celular debe tener exactamente 10 dígitos (ahora tiene " + t.length + ").";
    if (!RE_TELEFONO.test(t)) return "El celular debe empezar por 3. Ejemplo: 3001234567.";
    return "";
  }

  function validarCorreo(valor) {
    var c = String(valor || "").trim();
    if (!c) return "Escribe tu correo electrónico.";
    if (c.length > 120 || !RE_CORREO.test(c)) return "Escribe un correo válido. Ejemplo: nombre@correo.com.";
    return "";
  }

  function validarPrograma(valor) {
    return valor ? "" : "Selecciona un programa de formación.";
  }

  function validarAcepta(marcado) {
    return marcado ? "" : "Debes aceptar el tratamiento de datos personales para inscribirte.";
  }

  window.SENA_VALID = {
    limpiarNombre: limpiarNombre,
    validarNombre: validarNombre,
    validarTelefono: validarTelefono,
    validarCorreo: validarCorreo,
    validarPrograma: validarPrograma,
    validarAcepta: validarAcepta
  };
})();
