/**
 * @fileoverview Documentos legales de Espartanos y de cada local, generados desde una sola fuente.
 *
 * Espartanos es dueña de la plataforma y siempre publica sus propios documentos: política de
 * privacidad, condiciones de uso, medición y cookies, ejercicio de derechos y contrato de encargo.
 * Cada local es el responsable de los datos de sus clientes; si no publica su propia política, se
 * genera una con esta plantilla y **sus datos reales** (razón social, RUT, correo). Nunca con datos
 * inventados: sin esos datos la reserva o encuesta no se publica (`faltantesDeIdentidadLegal`).
 *
 * Los plazos de conservación salen de `PLAZOS_DE_CONSERVACION`, el mismo valor que usa el borrado
 * automático: el texto y el sistema no pueden contradecirse. Lo que se afirma sobre seguridad,
 * proveedores y decisiones automatizadas describe lo que la plataforma hace hoy; si eso cambia,
 * cambia el texto y su versión.
 *
 * Marco considerado: Ley 19.628 sobre protección de la vida privada, modificada por la Ley 21.719
 * (vigente desde el 1 de diciembre de 2026); Ley 19.496 de protección de los derechos de los
 * consumidores; Ley 19.799 sobre documentos y firma electrónica. Deben revisarse con asesoría
 * jurídica antes de su publicación definitiva y cada vez que la Agencia de Protección de Datos
 * Personales dicte instrucciones o normas de aplicación.
 */
/** Identidad de Espartanos como operador de la plataforma. Lo que aún no se conoce queda en `null` y no se muestra. */
export declare const OPERADOR_ESPARTANOS: {
    marca: string;
    correo: string;
    sitio: string;
    razonSocial: string | null;
    rut: string | null;
    domicilio: string | null;
    /** Proveedor de alojamiento de la plataforma y de los correos que envía. */
    alojamiento: string;
    /** Punto de contacto de privacidad: un cargo directivo, nunca un trabajador sin atribuciones. */
    contactoPrivacidad: string;
};
/** Meses que se conserva cada tipo de dato antes de anonimizarlo. */
export declare const PLAZOS_DE_CONSERVACION: {
    /**
     * Datos de quien reserva, contados desde la fecha de la visita: cubre el plazo para reclamar
     * como consumidor por esa reserva.
     */
    readonly reservasMeses: 24;
    /** Solicitudes de evento o grupo, contadas desde que se enviaron. */
    readonly solicitudesDeGrupoMeses: 24;
    /** Respuestas de encuestas con datos de contacto, contadas desde que se respondieron. */
    readonly encuestasMeses: 24;
    /**
     * Identificadores de medición (cookies de Meta, IP y navegador) guardados junto a una reserva.
     * Meta sólo acepta conversiones de hasta 7 días; el resto cubre revisión y reportes del período.
     */
    readonly medicionMeses: 6;
};
/** Días corridos para responder una solicitud de derechos, prorrogables una vez por el mismo plazo. */
export declare const PLAZO_RESPUESTA_DERECHOS_DIAS = 30;
/** Horas máximas para que Espartanos avise al local de una vulneración que afecte sus datos. */
export declare const PLAZO_AVISO_VULNERACION_HORAS = 48;
/** Versión vigente del conjunto de documentos. */
export declare const VERSION_DOCUMENTOS_LEGALES = "legal-2026-09-15b";
export declare const VIGENCIA_DOCUMENTOS_LEGALES = "2026-09-15";
export type IdDocumentoLegal = 'privacidad' | 'terminos' | 'servicio' | 'medicion' | 'encargo' | 'derechos';
export interface TablaLegal {
    columnas: string[];
    filas: string[][];
}
export interface SeccionLegal {
    titulo: string;
    parrafos: string[];
    lista?: string[];
    tabla?: TablaLegal;
    /** Párrafos que van después de la lista o la tabla. */
    cierre?: string[];
}
export interface DocumentoLegal {
    id: IdDocumentoLegal | 'privacidad-local';
    titulo: string;
    version: string;
    vigenteDesde: string;
    resumen: string;
    secciones: SeccionLegal[];
}
/** Datos legales de un local tal como están en su ficha. */
export interface IdentidadLegal {
    razonSocial?: string | null;
    rut?: string | null;
    correo?: string | null;
    nombreComercial?: string | null;
}
/** Lo que falta para que un local pueda publicar algo que recoge datos personales. Vacío si está completo. */
export declare function faltantesDeIdentidadLegal(identidad: IdentidadLegal): string[];
/** Mensaje para quien intenta publicar sin los datos legales del local. */
export declare function mensajeDeIdentidadIncompleta(faltan: string[]): string;
/** Cómo se nombra a Espartanos en los textos: con razón social y RUT cuando se conozcan. */
export declare function nombreLegalDelOperador(): string;
/** Cómo se nombra al local en los textos. */
export declare function nombreLegalDelLocal(identidad: IdentidadLegal): string;
/** Política de privacidad de la plataforma Espartanos. */
export declare function politicaDePrivacidadDeEspartanos(): DocumentoLegal;
/** Condiciones de uso de las páginas públicas de reservas y encuestas. */
export declare function condicionesDeUso(): DocumentoLegal;
/** Condiciones del servicio para las empresas que contratan Espartanos. */
export declare function condicionesDelServicio(): DocumentoLegal;
/** Política de medición publicitaria y cookies. */
export declare function politicaDeMedicion(): DocumentoLegal;
/** Contrato de encargo de tratamiento que acepta cada empresa al usar Reservas o Encuestas. */
export declare function contratoDeEncargo(): DocumentoLegal;
/** Cómo ejercer derechos sobre datos personales. */
export declare function ejercicioDeDerechos(): DocumentoLegal;
/**
 * Política de privacidad de un local que no publicó la suya, generada con sus datos reales.
 *
 * @param identidad Debe estar completa (`faltantesDeIdentidadLegal` vacío); si no, el formulario no se publica.
 */
export declare function politicaDePrivacidadDelLocal(identidad: IdentidadLegal): DocumentoLegal;
/** Todos los documentos de Espartanos, por identificador. */
export declare function documentoDeEspartanos(id: IdDocumentoLegal): DocumentoLegal;
export declare const DOCUMENTOS_DE_ESPARTANOS: Array<{
    id: IdDocumentoLegal;
    titulo: string;
}>;
/** Ruta pública de un documento de Espartanos. */
export declare function rutaDocumentoLegal(id: IdDocumentoLegal): string;
/** El documento en texto plano, para mostrarlo en una ventana o guardarlo como evidencia. */
export declare function documentoATexto(documento: DocumentoLegal): string;
/** Textos de las casillas de una reserva o solicitud, iguales en la página y en la evidencia que guarda el servidor. */
export declare function textosDeAceptacionDeReserva(identidad: IdentidadLegal, opciones?: {
    red?: string;
}): {
    /** Casilla obligatoria: aceptación de condiciones e información, no un consentimiento. */
    reserva: string;
    novedades: string;
    red: string;
    sensibles: string;
};
/** Versión del texto de consentimiento para datos sensibles. */
export declare const VERSION_DATOS_SENSIBLES = "sensibles-v1";
/**
 * Consentimiento expreso para información de salud o alimentación, separado de las demás casillas.
 * Se exige sólo cuando la persona completa un campo marcado como sensible.
 */
export declare function textoDeDatosSensibles(identidad: IdentidadLegal): string;
/** Campos de visita que siempre son datos de salud: accesibilidad y restricciones alimentarias. */
export declare const CAMPOS_DE_VISITA_SENSIBLES: readonly ["accessibilityNeed", "dietaryNotes"];
/**
 * Si lo enviado trae información sensible: un campo de visita de salud con texto o un campo del
 * formulario marcado como sensible con respuesta. Sólo entonces se exige el consentimiento expreso.
 */
export declare function traeDatosSensibles(campos: Array<{
    id: string;
    sensible?: boolean;
}>, respuestas: Record<string, unknown> | null | undefined, visita?: Record<string, unknown>): boolean;
export declare const MENSAJE_FALTA_CONSENTIMIENTO_SENSIBLE = "Para guardar la informaci\u00F3n de salud o alimentaci\u00F3n que indicaste, marca la casilla que la autoriza. Si prefieres, b\u00F3rrala y env\u00EDa sin ella.";
//# sourceMappingURL=documentos-legales.d.ts.map