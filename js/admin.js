// Panel del instructor: inicio de sesión, lista de inscritos y descarga en CSV.
// La sesión vive solo en esta pestaña (sessionStorage): se pierde al cerrarla.
(function () {
  "use strict";

  var CFG = window.SENA_CONFIG || {};
  var PROGRAMAS = window.SENA_PROGRAMAS || [];

  function $(id) { return document.getElementById(id); }
  function crear(tag, texto) {
    var e = document.createElement(tag);
    if (texto !== undefined) e.textContent = texto;
    return e;
  }
  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  var db = null;
  var inscritos = [];
  var cupos = {};

  var nombrePrograma = {};
  PROGRAMAS.forEach(function (p) { nombrePrograma[p.id] = p.nombre; });

  // ---------- Utilidades ----------
  // "2026-11-21 19:30" en hora de Colombia.
  function formatoFecha(iso) {
    try {
      return new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 16);
    } catch (e) { return String(iso); }
  }

  // Celda de CSV: entre comillas, y con ' delante si empieza como una fórmula de Excel.
  function celdaCsv(valor) {
    var s = String(valor === null || valor === undefined ? "" : valor);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function descargarCsv() {
    // Separador ";" porque Excel en español (Colombia) lo usa para separar columnas.
    var filas = [["N°", "Nombre completo", "Teléfono", "Correo", "Programa", "Fecha y hora"]];
    inscritos.forEach(function (f, i) {
      filas.push([i + 1, f.nombre_completo, f.telefono, f.correo,
                  nombrePrograma[f.programa_id] || f.programa_id, formatoFecha(f.creado_en)]);
    });
    var texto = "﻿" + filas.map(function (fila) { return fila.map(celdaCsv).join(";"); }).join("\r\n");
    var blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "inscritos_sena_" + new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- Pintar ----------
  function pintarResumen() {
    var cont = $("resumen");
    vaciar(cont);
    var total = 0;
    PROGRAMAS.forEach(function (p) {
      var info = cupos[p.id] || { max: 0, ocupados: 0, disponibles: 0 };
      total += info.ocupados;
      var art = crear("article");
      art.className = "tarjeta";
      art.appendChild(crear("h3", p.nombre));
      art.appendChild(crear("p", String(info.ocupados))).className = "tarjeta-numero";
      art.appendChild(crear("p", "inscritos de " + info.max + " · quedan " + info.disponibles)).className = "tarjeta-etiqueta";
      cont.appendChild(art);
    });
    var t = crear("article");
    t.className = "tarjeta";
    t.appendChild(crear("h3", "Total de inscritos"));
    t.appendChild(crear("p", String(total))).className = "tarjeta-numero";
    cont.appendChild(t);
  }

  function pintarTabla() {
    var filtro = $("filtro").value;
    var cuerpo = $("filas");
    vaciar(cuerpo);
    var lista = inscritos.filter(function (f) { return !filtro || f.programa_id === filtro; });
    lista.forEach(function (f, i) {
      var tr = document.createElement("tr");
      [i + 1, f.nombre_completo, f.telefono, f.correo,
       nombrePrograma[f.programa_id] || f.programa_id, formatoFecha(f.creado_en)
      ].forEach(function (v) { tr.appendChild(crear("td", String(v))); });
      cuerpo.appendChild(tr);
    });
    $("vacio").hidden = lista.length > 0;
  }

  async function cargarDatos() {
    $("aviso-panel").hidden = true;
    try {
      var a = await db.from("inscripciones")
        .select("id,nombre_completo,telefono,correo,programa_id,creado_en")
        .order("creado_en", { ascending: true });
      if (a.error) throw a.error;
      inscritos = a.data || [];

      var b = await db.rpc("obtener_cupos");
      if (b.error) throw b.error;
      cupos = {};
      (b.data || []).forEach(function (f) {
        cupos[f.programa_id] = { max: f.cupos_max, ocupados: f.ocupados, disponibles: f.disponibles };
      });
      pintarResumen();
      pintarTabla();
    } catch (e) {
      var av = $("aviso-panel");
      av.textContent = "No se pudieron cargar los datos. Revisa tu conexión e intenta con “Actualizar”.";
      av.hidden = false;
    }
  }

  // ---------- Sesión ----------
  function mostrarLogin(mensaje) {
    $("vista-panel").hidden = true;
    $("vista-login").hidden = false;
    var e = $("login-error");
    e.textContent = mensaje || "";
    e.hidden = !mensaje;
  }

  async function mostrarPanel() {
    // Comprueba que el usuario esté en la lista de instructores autorizados.
    var r = await db.rpc("es_instructor");
    if (r.error || r.data !== true) {
      await db.auth.signOut();
      mostrarLogin("Este usuario no tiene permiso para ver las inscripciones.");
      return;
    }
    $("vista-login").hidden = true;
    $("vista-panel").hidden = false;
    await cargarDatos();
  }

  async function entrar(ev) {
    ev.preventDefault();
    var correo = $("login-correo").value.trim();
    var clave = $("login-clave").value;
    if (!correo || !clave) { mostrarLogin("Escribe tu correo y tu contraseña."); return; }
    var boton = $("login-enviar");
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      var r = await db.auth.signInWithPassword({ email: correo, password: clave });
      if (r.error) { mostrarLogin("Correo o contraseña incorrectos."); return; }
      $("login-clave").value = "";
      await mostrarPanel();
    } catch (e) {
      mostrarLogin("No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  }

  async function salir() {
    await db.auth.signOut();
    inscritos = [];
    vaciar($("filas"));
    mostrarLogin("");
  }

  // ---------- Inicio ----------
  async function iniciar() {
    var configurado =
      CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
      CFG.SUPABASE_URL.indexOf("TU-PROYECTO") === -1 && CFG.SUPABASE_ANON_KEY.indexOf("PEGA_AQUI") === -1;
    if (!configurado || !window.supabase || !window.supabase.createClient) {
      var av = $("aviso-config");
      av.textContent = configurado
        ? "No se pudo cargar la librería de la base de datos. Revisa tu conexión y recarga."
        : "Falta configurar js/config.js con los datos de tu proyecto Supabase (mira el README).";
      av.hidden = false;
      return;
    }

    PROGRAMAS.forEach(function (p) {
      var op = crear("option", p.nombre);
      op.value = p.id;
      $("filtro").appendChild(op);
    });

    db = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.sessionStorage, detectSessionInUrl: false }
    });

    $("form-login").addEventListener("submit", entrar);
    $("btn-salir").addEventListener("click", salir);
    $("btn-actualizar").addEventListener("click", cargarDatos);
    $("btn-csv").addEventListener("click", descargarCsv);
    $("filtro").addEventListener("change", pintarTabla);

    var s = await db.auth.getSession();
    if (s.data && s.data.session) await mostrarPanel();
    else mostrarLogin("");
  }

  iniciar();
})();
