// Lógica del formulario público de preinscripción.
// No guarda datos personales en el navegador: todo va a la base de datos.
(function () {
  "use strict";

  var CFG = window.SENA_CONFIG || {};
  var PROGRAMAS = window.SENA_PROGRAMAS || [];
  var V = window.SENA_VALID;

  var REFRESCO_MS = 15000; // cada cuánto se actualizan los cupos
  var MSG_DUPLICADO = "Este estudiante ya cuenta con un registro previo en un programa de formación.";
  var MSG_SIN_CUPOS = "Este programa acaba de quedar sin cupos. Por favor elige otro.";
  var MSG_RED = "No pudimos guardar tu inscripción. Revisa tu conexión e inténtalo de nuevo.";

  function $(id) { return document.getElementById(id); }
  function crear(tag, clase) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    return e;
  }
  function vaciar(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

  var db = null;            // cliente de Supabase
  var cupos = {};           // id programa -> { max, ocupados, disponibles }
  var cargando = false;
  var guardando = false;
  var tocado = {};          // campos que el estudiante ya visitó
  var tarjetas = {};        // referencias a las tarjetas
  var opciones = {};        // referencias a las <option>

  // ---------- Configuración ----------
  var configurado =
    !!CFG.SUPABASE_URL && !!CFG.SUPABASE_ANON_KEY &&
    CFG.SUPABASE_URL.indexOf("TU-PROYECTO") === -1 &&
    CFG.SUPABASE_ANON_KEY.indexOf("PEGA_AQUI") === -1;

  // ---------- Campos y sus validaciones ----------
  function programaAgotado(id) {
    return !!(id && cupos[id] && cupos[id].disponibles <= 0);
  }

  var CAMPOS = {
    nombre: {
      el: $("nombre"), err: $("error-nombre"),
      leer: function () { return $("nombre").value; },
      validar: V.validarNombre
    },
    telefono: {
      el: $("telefono"), err: $("error-telefono"),
      leer: function () { return $("telefono").value; },
      validar: V.validarTelefono
    },
    correo: {
      el: $("correo"), err: $("error-correo"),
      leer: function () { return $("correo").value; },
      validar: V.validarCorreo
    },
    programa: {
      el: $("programa"), err: $("error-programa"),
      leer: function () { return $("programa").value; },
      validar: function (v) {
        return V.validarPrograma(v) || (programaAgotado(v) ? "Ese programa ya no tiene cupos. Elige otro." : "");
      }
    },
    acepta: {
      el: $("acepta"), err: $("error-acepta"),
      leer: function () { return $("acepta").checked; },
      validar: V.validarAcepta
    }
  };
  var ORDEN = ["nombre", "telefono", "correo", "programa", "acepta"];

  function mostrarError(clave, mensaje) {
    var c = CAMPOS[clave];
    c.err.textContent = mensaje || "";
    if (mensaje) c.el.setAttribute("aria-invalid", "true");
    else c.el.removeAttribute("aria-invalid");
  }

  function validarCampo(clave) {
    var c = CAMPOS[clave];
    var msg = c.validar(c.leer());
    mostrarError(clave, msg);
    return !msg;
  }

  function hayErrores() {
    return ORDEN.some(function (k) { return !!CAMPOS[k].validar(CAMPOS[k].leer()); });
  }

  function actualizarBoton() {
    $("enviar").disabled = guardando || !configurado || hayErrores();
  }

  // ---------- Tarjetas y select ----------
  function buscarPrograma(id) {
    for (var i = 0; i < PROGRAMAS.length; i++) if (PROGRAMAS[i].id === id) return PROGRAMAS[i];
    return null;
  }

  function elegirPrograma(id) {
    var sel = $("programa");
    sel.value = id;
    tocado.programa = true;
    mostrarDescripcion(id);
    validarCampo("programa");
    actualizarBoton();
    $("inscripcion").scrollIntoView({ behavior: "smooth", block: "start" });
    sel.focus({ preventScroll: true });
  }

  function crearTarjetasYOpciones() {
    var cont = $("tarjetas");
    var sel = $("programa");

    PROGRAMAS.forEach(function (p) {
      var art = crear("article", "tarjeta");
      var h3 = crear("h3");
      h3.textContent = p.nombre;
      var num = crear("p", "tarjeta-numero");
      num.textContent = "—";
      var etiqueta = crear("p", "tarjeta-etiqueta");
      etiqueta.textContent = "cupos disponibles";
      var barra = crear("div", "barra");
      barra.setAttribute("aria-hidden", "true");
      var relleno = crear("div", "barra-relleno");
      barra.appendChild(relleno);
      var insignia = crear("p", "insignia");
      var boton = crear("button", "boton-secundario");
      boton.type = "button";
      boton.textContent = "Elegir este programa";
      boton.addEventListener("click", function () { elegirPrograma(p.id); });

      art.appendChild(h3);
      art.appendChild(num);
      art.appendChild(etiqueta);
      art.appendChild(barra);
      art.appendChild(insignia);
      art.appendChild(boton);
      cont.appendChild(art);
      tarjetas[p.id] = { art: art, num: num, etiqueta: etiqueta, relleno: relleno, insignia: insignia, boton: boton };

      var op = crear("option");
      op.value = p.id;
      op.textContent = p.nombre;
      sel.appendChild(op);
      opciones[p.id] = op;
    });
  }

  function pintarCupos() {
    PROGRAMAS.forEach(function (p) {
      var t = tarjetas[p.id];
      var info = cupos[p.id];
      if (!info) {
        t.num.textContent = "—";
        t.insignia.textContent = "";
        t.art.classList.remove("agotado");
        t.boton.disabled = false;
        return;
      }
      var agotado = info.disponibles <= 0;
      t.num.textContent = String(info.disponibles);
      t.etiqueta.textContent = info.disponibles === 1 ? "cupo disponible" : "cupos disponibles";
      var pct = info.max > 0 ? Math.min(100, Math.round((info.ocupados / info.max) * 100)) : 100;
      t.relleno.style.width = pct + "%";
      t.art.classList.toggle("agotado", agotado);
      t.insignia.textContent = agotado ? "Cupos agotados" : (info.disponibles <= 5 ? "¡Últimos cupos!" : "");
      t.boton.disabled = agotado;
    });
  }

  function actualizarSelect() {
    var sel = $("programa");
    PROGRAMAS.forEach(function (p) {
      var op = opciones[p.id];
      var info = cupos[p.id];
      if (info && info.disponibles <= 0) {
        op.disabled = true;
        op.textContent = p.nombre + " — Cupos agotados";
      } else {
        op.disabled = false;
        op.textContent = p.nombre;
      }
    });
    // Si el estudiante tenía elegido un programa que se acaba de llenar:
    if (sel.value && programaAgotado(sel.value)) {
      sel.value = "";
      mostrarDescripcion("");
      mostrarError("programa", "El programa que elegiste se quedó sin cupos. Elige otro.");
    }
  }

  function mostrarDescripcion(id) {
    var caja = $("descripcion-programa");
    var p = buscarPrograma(id);
    vaciar(caja);
    if (!p) { caja.hidden = true; return; }
    var titulo = crear("strong");
    titulo.textContent = p.nombre;
    var texto = crear("p");
    texto.textContent = p.descripcion;
    caja.appendChild(titulo);
    caja.appendChild(texto);
    caja.hidden = false;
  }

  // ---------- Cupos desde la base de datos ----------
  async function cargarCupos() {
    if (!db || cargando) return;
    cargando = true;
    try {
      var r = await db.rpc("obtener_cupos");
      if (r.error) throw r.error;
      var nuevos = {};
      (r.data || []).forEach(function (f) {
        nuevos[f.programa_id] = { max: f.cupos_max, ocupados: f.ocupados, disponibles: f.disponibles };
      });
      cupos = nuevos;
      $("aviso-cupos").hidden = true;
    } catch (e) {
      $("aviso-cupos").hidden = false;
    } finally {
      cargando = false;
    }
    pintarCupos();
    actualizarSelect();
    actualizarBoton();
  }

  // ---------- Mensajes ----------
  function ocultarMensajes() {
    $("mensaje-global").hidden = true;
    $("confirmacion").hidden = true;
  }

  function mostrarErrorGlobal(texto) {
    var caja = $("mensaje-global");
    caja.textContent = texto;
    caja.hidden = false;
    caja.scrollIntoView({ behavior: "smooth", block: "center" });
    caja.focus({ preventScroll: true });
  }

  function mostrarConfirmacion(nombre, programa) {
    var caja = $("confirmacion");
    vaciar(caja);
    var p1 = crear("p");
    p1.textContent = "¡Inscripción exitosa!";
    var p2 = crear("p");
    p2.textContent = nombre + " quedó registrado(a) en el programa " + programa + ". ¡Gracias por participar!";
    caja.appendChild(p1);
    caja.appendChild(p2);
    caja.hidden = false;
    caja.scrollIntoView({ behavior: "smooth", block: "start" });
    caja.focus({ preventScroll: true });
  }

  function limpiarFormulario() {
    $("form").reset();
    tocado = {};
    ORDEN.forEach(function (k) { mostrarError(k, ""); });
    mostrarDescripcion("");
  }

  // ---------- Eventos del formulario ----------
  function limpiarTelefono() {
    var el = $("telefono");
    var digitos = el.value.replace(/\D/g, "");
    if (digitos.length === 12 && digitos.indexOf("57") === 0) digitos = digitos.slice(2); // pegó +57...
    digitos = digitos.slice(0, 10);
    if (el.value !== digitos) el.value = digitos;
  }

  function enlazarEventos() {
    ["nombre", "telefono", "correo"].forEach(function (k) {
      var el = CAMPOS[k].el;
      el.addEventListener("input", function () {
        if (k === "telefono") limpiarTelefono();
        if (tocado[k]) validarCampo(k);
        actualizarBoton();
      });
      el.addEventListener("blur", function () {
        if (k === "nombre") el.value = V.limpiarNombre(el.value);
        tocado[k] = true;
        validarCampo(k);
        actualizarBoton();
      });
    });

    $("programa").addEventListener("change", function () {
      tocado.programa = true;
      mostrarDescripcion($("programa").value);
      validarCampo("programa");
      actualizarBoton();
    });

    $("acepta").addEventListener("change", function () {
      tocado.acepta = true;
      validarCampo("acepta");
      actualizarBoton();
    });

    $("form").addEventListener("submit", enviar);
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (guardando || !db) return;
    ocultarMensajes();

    // Muestra todos los errores y lleva al primero.
    var primero = null;
    ORDEN.forEach(function (k) {
      tocado[k] = true;
      if (!validarCampo(k) && !primero) primero = k;
    });
    if (primero) { CAMPOS[primero].el.focus(); actualizarBoton(); return; }

    guardando = true;
    var boton = $("enviar");
    boton.disabled = true;
    boton.textContent = "Guardando…";

    try {
      var r = await db.rpc("registrar_estudiante", {
        p_nombre: V.limpiarNombre(CAMPOS.nombre.leer()),
        p_telefono: CAMPOS.telefono.leer().trim(),
        p_correo: CAMPOS.correo.leer().trim().toLowerCase(),
        p_programa: CAMPOS.programa.leer(),
        p_acepta: CAMPOS.acepta.leer()
      });
      if (r.error) throw r.error;
      var res = r.data || {};

      if (res.ok) {
        limpiarFormulario();
        mostrarConfirmacion(res.nombre, res.programa);
      } else if (res.codigo === "duplicado") {
        mostrarErrorGlobal(MSG_DUPLICADO);
      } else if (res.codigo === "sin_cupos") {
        $("programa").value = "";
        mostrarDescripcion("");
        mostrarErrorGlobal(MSG_SIN_CUPOS);
      } else {
        mostrarErrorGlobal(res.mensaje || MSG_RED);
      }
    } catch (e) {
      mostrarErrorGlobal(MSG_RED);
    } finally {
      guardando = false;
      boton.textContent = "Enviar inscripción";
      await cargarCupos();   // refresca los números y el estado del botón
      actualizarBoton();
    }
  }

  // ---------- Inicio ----------
  function iniciar() {
    crearTarjetasYOpciones();
    enlazarEventos();
    actualizarBoton();

    if (!configurado) {
      var aviso = $("aviso-config");
      aviso.textContent = "Falta configurar la aplicación: abre el archivo js/config.js y pega la URL y la clave de tu proyecto Supabase (mira el README).";
      aviso.hidden = false;
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      var a = $("aviso-config");
      a.textContent = "No se pudo cargar la librería de la base de datos. Revisa tu conexión a internet y recarga la página.";
      a.hidden = false;
      return;
    }

    // Sin sesión y sin guardar nada en el navegador.
    db = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    cargarCupos();
    setInterval(function () { if (!document.hidden && !guardando) cargarCupos(); }, REFRESCO_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) cargarCupos(); });
  }

  iniciar();
})();
