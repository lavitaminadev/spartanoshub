"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfDeTabla = pdfDeTabla;
const ANCHO = 595;
const ALTO = 842;
const MARGEN = 40;
const TAMANO = 9;
const ALTO_FILA = 15;
function winAnsi(texto) {
    let salida = '';
    for (const caracter of texto.normalize('NFC')) {
        const codigo = caracter.charCodeAt(0);
        if (codigo < 32)
            salida += ' ';
        else if (codigo <= 255 && !(codigo >= 127 && codigo < 160))
            salida += caracter;
        else
            salida += '?';
    }
    return salida;
}
const escapar = (texto) => winAnsi(texto).replace(/[\\()]/g, (c) => `\\${c}`);
function ajustar(texto, ancho) {
    const maximo = Math.max(4, Math.floor((ancho - 6) / 4.6));
    const limpio = texto.replace(/\s+/g, ' ').trim();
    return limpio.length <= maximo ? limpio : `${limpio.slice(0, maximo - 3)}...`;
}
function pdfDeTabla(tabla) {
    const paginas = [[]];
    let y = ALTO - MARGEN;
    const emitir = (operacion) => paginas[paginas.length - 1].push(operacion);
    const texto = (valor, x, yy, negrita = false, tamano = TAMANO) => emitir(`BT /${negrita ? 'F2' : 'F1'} ${tamano} Tf ${x} ${yy} Td (${escapar(valor)}) Tj ET`);
    const cabecera = () => {
        let x = MARGEN;
        tabla.cabeceras.forEach((nombre, i) => {
            texto(ajustar(nombre, tabla.anchos[i]), x + 3, y, true);
            x += tabla.anchos[i];
        });
        emitir(`0.5 w ${MARGEN} ${y - 4} m ${ANCHO - MARGEN} ${y - 4} l S`);
        y -= ALTO_FILA;
    };
    texto(tabla.titulo, MARGEN, y, true, 14);
    y -= 20;
    for (const linea of tabla.lineas) {
        texto(ajustar(linea, ANCHO - 2 * MARGEN + 6), MARGEN, y);
        y -= 12;
    }
    y -= 8;
    cabecera();
    for (const fila of tabla.filas) {
        if (y < MARGEN + 30) {
            paginas.push([]);
            y = ALTO - MARGEN;
            cabecera();
        }
        let x = MARGEN;
        fila.forEach((celda, i) => {
            texto(ajustar(celda, tabla.anchos[i]), x + 3, y);
            x += tabla.anchos[i];
        });
        y -= ALTO_FILA;
    }
    paginas.forEach((operaciones, indice) => {
        operaciones.push(`BT /F1 8 Tf ${MARGEN} ${MARGEN - 14} Td (${escapar(ajustar(tabla.pie, 460))}) Tj ET`);
        operaciones.push(`BT /F1 8 Tf ${ANCHO - MARGEN - 60} ${MARGEN - 14} Td (${escapar(`Hoja ${indice + 1} de ${paginas.length}`)}) Tj ET`);
    });
    const objetos = [];
    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[2] = `<< /Type /Pages /Kids [${paginas.map((_p, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`;
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    paginas.forEach((operaciones, i) => {
        const contenido = operaciones.join('\n');
        objetos[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
        objetos[6 + i * 2] = `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`;
    });
    let cuerpo = '%PDF-1.4\n';
    const desplazamientos = [];
    for (let n = 1; n < objetos.length; n++) {
        desplazamientos[n] = Buffer.byteLength(cuerpo, 'latin1');
        cuerpo += `${n} 0 obj\n${objetos[n]}\nendobj\n`;
    }
    const inicioXref = Buffer.byteLength(cuerpo, 'latin1');
    cuerpo += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let n = 1; n < objetos.length; n++)
        cuerpo += `${String(desplazamientos[n]).padStart(10, '0')} 00000 n \n`;
    cuerpo += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
    return Buffer.from(cuerpo, 'latin1');
}
