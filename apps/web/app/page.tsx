'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Sesion,
  autenticacionHabilitada,
  cerrarSesion,
  ErrorSesionExpirada,
  fetchAutorizado,
  iniciarSesion,
  obtenerSesion,
} from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Persona = {
  id: number;
  nombreCompleto: string;
  rfc: string;
  correo: string;
  codigoPostal: string;
  creadoEn?: string;
  actualizadoEn?: string;
};

type ErrorDetalle = { campo: string; mensaje: string };

type FormularioPersona = {
  nombreCompleto: string;
  rfc: string;
  correo: string;
  codigoPostal: string;
};

const FORMULARIO_VACIO: FormularioPersona = {
  nombreCompleto: '',
  rfc: '',
  correo: '',
  codigoPostal: '',
};

export default function PaginaPersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [formulario, setFormulario] = useState<FormularioPersona>(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [errores, setErrores] = useState<ErrorDetalle[]>([]);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Sesión de Cognito. Se lee tras montar para no chocar con el render del servidor.
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [loginCorreo, setLoginCorreo] = useState('');
  const [loginContrasena, setLoginContrasena] = useState('');
  const [loginError, setLoginError] = useState('');
  const [ingresando, setIngresando] = useState(false);

  useEffect(() => {
    setSesion(obtenerSesion());
    setSesionLista(true);
  }, []);

  const manejarSesionExpirada = useCallback(() => {
    setSesion(null);
    setErrorApi('Tu sesión expiró. Inicia sesión de nuevo.');
  }, []);

  const cargarPersonas = useCallback(async () => {
    try {
      const res = await fetchAutorizado(`${API_URL}/api/personas`, { cache: 'no-store' });
      const cuerpo = await res.json();
      setPersonas(cuerpo.data ?? []);
      setErrorApi('');
    } catch (error) {
      if (error instanceof ErrorSesionExpirada) return manejarSesionExpirada();
      setErrorApi(
        `No se pudo conectar con la API (${API_URL}). Verifica que el microservicio esté corriendo.`
      );
    } finally {
      setCargando(false);
    }
  }, [manejarSesionExpirada]);

  const haySesion = !autenticacionHabilitada || sesion !== null;

  useEffect(() => {
    if (sesionLista && haySesion) cargarPersonas();
  }, [sesionLista, haySesion, cargarPersonas]);

  const enviarLogin = async (evento: FormEvent) => {
    evento.preventDefault();
    setLoginError('');
    setIngresando(true);
    try {
      const nueva = await iniciarSesion(loginCorreo.trim(), loginContrasena);
      setSesion(nueva);
      setLoginContrasena('');
      setErrorApi('');
      setCargando(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIngresando(false);
    }
  };

  const salir = () => {
    cerrarSesion();
    setSesion(null);
    setPersonas([]);
    setMensajeExito('');
    setErrores([]);
    setErrorApi('');
  };

  const actualizarCampo = (campo: keyof FormularioPersona, valor: string) => {
    setFormulario((previo) => ({
      ...previo,
      [campo]: campo === 'rfc' ? valor.toUpperCase() : valor,
    }));
  };

  const limpiarFormulario = () => {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setErrores([]);
  };

  const enviarFormulario = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrores([]);
    setMensajeExito('');
    setGuardando(true);
    const esCreacion = editandoId === null;
    const url = esCreacion
      ? `${API_URL}/api/personas`
      : `${API_URL}/api/personas/${editandoId}`;
    try {
      const res = await fetchAutorizado(url, {
        method: esCreacion ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      });
      const cuerpo = await res.json();
      if (!res.ok) {
        setErrores(
          cuerpo.detalles ?? [{ campo: 'general', mensaje: cuerpo.error ?? 'Error inesperado' }]
        );
        return;
      }
      setMensajeExito(esCreacion ? 'Registro creado correctamente.' : 'Registro actualizado correctamente.');
      limpiarFormulario();
      await cargarPersonas();
    } catch (error) {
      if (error instanceof ErrorSesionExpirada) return manejarSesionExpirada();
      setErrores([{ campo: 'general', mensaje: `No se pudo conectar con la API (${API_URL}).` }]);
    } finally {
      setGuardando(false);
    }
  };

  const iniciarEdicion = (persona: Persona) => {
    setEditandoId(persona.id);
    setFormulario({
      nombreCompleto: persona.nombreCompleto,
      rfc: persona.rfc,
      correo: persona.correo,
      codigoPostal: persona.codigoPostal,
    });
    setErrores([]);
    setMensajeExito('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarPersona = async (persona: Persona) => {
    if (!window.confirm(`¿Eliminar el registro de "${persona.nombreCompleto}"?`)) return;
    setMensajeExito('');
    setErrores([]);
    try {
      const res = await fetchAutorizado(`${API_URL}/api/personas/${persona.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMensajeExito('Registro eliminado correctamente.');
        if (editandoId === persona.id) limpiarFormulario();
        await cargarPersonas();
      } else {
        const cuerpo = await res.json();
        setErrores([{ campo: 'general', mensaje: cuerpo.error ?? 'No se pudo eliminar el registro' }]);
      }
    } catch (error) {
      if (error instanceof ErrorSesionExpirada) return manejarSesionExpirada();
      setErrores([{ campo: 'general', mensaje: `No se pudo conectar con la API (${API_URL}).` }]);
    }
  };

  // Evita el parpadeo servidor/cliente mientras se lee la sesión guardada.
  if (autenticacionHabilitada && !sesionLista) {
    return (
      <main className="contenedor">
        <p className="texto-suave">Cargando…</p>
      </main>
    );
  }

  if (!haySesion) {
    return (
      <main className="contenedor">
        <header className="encabezado">
          <h1>Registro de Personas</h1>
          <p>Microservicio CRUD — Node.js + Express + MySQL</p>
        </header>

        {errorApi && <div className="alerta alerta-error">{errorApi}</div>}

        <section className="tarjeta tarjeta-login">
          <h2>Iniciar sesión</h2>
          <p className="texto-suave">Acceso protegido con Amazon Cognito.</p>
          <form onSubmit={enviarLogin} className="formulario">
            <div className="campo">
              <label htmlFor="loginCorreo">Correo electrónico</label>
              <input
                id="loginCorreo"
                type="email"
                value={loginCorreo}
                onChange={(e) => setLoginCorreo(e.target.value)}
                placeholder="usuario@dominio.com"
                autoComplete="username"
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="loginContrasena">Contraseña</label>
              <input
                id="loginContrasena"
                type="password"
                value={loginContrasena}
                onChange={(e) => setLoginContrasena(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {loginError && (
              <ul className="lista-errores">
                <li>{loginError}</li>
              </ul>
            )}

            <div className="acciones-formulario">
              <button type="submit" className="boton boton-primario" disabled={ingresando}>
                {ingresando ? 'Ingresando…' : 'Ingresar'}
              </button>
            </div>
          </form>
        </section>

        <footer className="pie">
          <p>
            API: <code>{API_URL}</code>
          </p>
        </footer>
      </main>
    );
  }

  return (
    <main className="contenedor">
      <header className="encabezado">
        <div className="barra-sesion">
          <div>
            <h1>Registro de Personas</h1>
            <p>Microservicio CRUD — Node.js + Express + MySQL</p>
          </div>
          {autenticacionHabilitada && sesion && (
            <div className="datos-sesion">
              <span className="texto-suave">{sesion.correo}</span>
              <button type="button" className="boton boton-secundario boton-chico" onClick={salir}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {errorApi && <div className="alerta alerta-error">{errorApi}</div>}
      {mensajeExito && <div className="alerta alerta-exito">{mensajeExito}</div>}

      <section className="tarjeta">
        <h2>{editandoId === null ? 'Nuevo registro' : `Editando registro #${editandoId}`}</h2>
        <form onSubmit={enviarFormulario} className="formulario">
          <div className="cuadricula">
            <div className="campo">
              <label htmlFor="nombreCompleto">Nombre completo *</label>
              <input
                id="nombreCompleto"
                value={formulario.nombreCompleto}
                onChange={(e) => actualizarCampo('nombreCompleto', e.target.value)}
                placeholder="Ej. Juana Pérez López"
                maxLength={255}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="rfc">RFC *</label>
              <input
                id="rfc"
                value={formulario.rfc}
                onChange={(e) => actualizarCampo('rfc', e.target.value)}
                placeholder="Ej. PELJ900101AB1"
                maxLength={13}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="correo">Correo electrónico *</label>
              <input
                id="correo"
                type="email"
                value={formulario.correo}
                onChange={(e) => actualizarCampo('correo', e.target.value)}
                placeholder="Ej. juana@ejemplo.com"
                maxLength={254}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="codigoPostal">Código postal *</label>
              <input
                id="codigoPostal"
                value={formulario.codigoPostal}
                onChange={(e) => actualizarCampo('codigoPostal', e.target.value)}
                placeholder="Ej. 06600"
                maxLength={5}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          {errores.length > 0 && (
            <ul className="lista-errores">
              {errores.map((error, indice) => (
                <li key={`${error.campo}-${indice}`}>
                  {error.campo && error.campo !== 'general' ? <strong>{error.campo}: </strong> : null}
                  {error.mensaje}
                </li>
              ))}
            </ul>
          )}

          <div className="acciones-formulario">
            <button type="submit" className="boton boton-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId === null ? 'Crear registro' : 'Guardar cambios'}
            </button>
            {editandoId !== null && (
              <button type="button" className="boton boton-secundario" onClick={limpiarFormulario}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <div className="encabezado-tabla">
          <h2>Registros ({personas.length})</h2>
          <button type="button" className="boton boton-secundario" onClick={cargarPersonas}>
            Actualizar lista
          </button>
        </div>
        {cargando ? (
          <p className="texto-suave">Cargando registros…</p>
        ) : personas.length === 0 ? (
          <p className="texto-suave">No hay registros todavía. Crea el primero con el formulario de arriba.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre completo</th>
                  <th>RFC</th>
                  <th>Correo</th>
                  <th>C.P.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td>{persona.id}</td>
                    <td>{persona.nombreCompleto}</td>
                    <td>
                      <code>{persona.rfc}</code>
                    </td>
                    <td>{persona.correo}</td>
                    <td>{persona.codigoPostal}</td>
                    <td className="celda-acciones">
                      <button
                        type="button"
                        className="boton boton-secundario boton-chico"
                        onClick={() => iniciarEdicion(persona)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton boton-peligro boton-chico"
                        onClick={() => eliminarPersona(persona)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="pie">
        <p>
          API: <code>{API_URL}</code>
        </p>
      </footer>
    </main>
  );
}
