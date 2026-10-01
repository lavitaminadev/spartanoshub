"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planillaXlsx = planillaXlsx;
const node_zlib_1 = require("node:zlib");
function escribirZip(entradas) {
    const locales = [];
    const central = [];
    let desplazamiento = 0;
    for (const { nombre, datos } of entradas) {
        const nombreBuf = Buffer.from(nombre, 'utf8');
        const suma = (0, node_zlib_1.crc32)(datos);
        const cabecera = Buffer.alloc(30);
        cabecera.writeUInt32LE(0x04034b50, 0);
        cabecera.writeUInt16LE(20, 4);
        cabecera.writeUInt16LE(0x0800, 6);
        cabecera.writeUInt16LE(0, 8);
        cabecera.writeUInt32LE(suma, 14);
        cabecera.writeUInt32LE(datos.length, 18);
        cabecera.writeUInt32LE(datos.length, 22);
        cabecera.writeUInt16LE(nombreBuf.length, 26);
        locales.push(cabecera, nombreBuf, datos);
        const entradaCentral = Buffer.alloc(46);
        entradaCentral.writeUInt32LE(0x02014b50, 0);
        entradaCentral.writeUInt16LE(20, 4);
        entradaCentral.writeUInt16LE(20, 6);
        entradaCentral.writeUInt16LE(0x0800, 8);
        entradaCentral.writeUInt16LE(0, 10);
        entradaCentral.writeUInt32LE(suma, 16);
        entradaCentral.writeUInt32LE(datos.length, 20);
        entradaCentral.writeUInt32LE(datos.length, 24);
        entradaCentral.writeUInt16LE(nombreBuf.length, 28);
        entradaCentral.writeUInt32LE(desplazamiento, 42);
        central.push(entradaCentral, nombreBuf);
        desplazamiento += cabecera.length + nombreBuf.length + datos.length;
    }
    const cuerpoCentral = Buffer.concat(central);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(entradas.length, 8);
    fin.writeUInt16LE(entradas.length, 10);
    fin.writeUInt32LE(cuerpoCentral.length, 12);
    fin.writeUInt32LE(desplazamiento, 16);
    return Buffer.concat([...locales, cuerpoCentral, fin]);
}
const escapar = (valor) => String(valor ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function letra(indice) {
    let n = indice;
    let salida = '';
    while (n > 0) {
        const resto = (n - 1) % 26;
        salida = String.fromCharCode(65 + resto) + salida;
        n = Math.floor((n - resto) / 26);
    }
    return salida;
}
function planillaXlsx(cabeceras, filas, hoja = 'Datos') {
    const nombreHoja = escapar(hoja).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Datos';
    const anchos = cabeceras.map((cabecera, columna) => {
        const largos = [String(cabecera).length, ...filas.map((fila) => String(fila[columna] ?? '').length)];
        return Math.min(60, Math.max(10, Math.max(...largos) + 2));
    });
    const celda = (texto, columna, fila, estilo) => `<c r="${letra(columna + 1)}${fila}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${escapar(texto)}</t></is></c>`;
    const xmlFilas = [
        `<row r="1">${cabeceras.map((c, i) => celda(c, i, 1, 1)).join('')}</row>`,
        ...filas.map((fila, indice) => `<row r="${indice + 2}">${cabeceras.map((_c, i) => celda(fila[i], i, indice + 2, 0)).join('')}</row>`),
    ].join('');
    const hojaXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos.map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xmlFilas}</sheetData>
<autoFilter ref="A1:${letra(cabeceras.length)}${filas.length + 1}"/>
</worksheet>`;
    const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E8C82"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>
</styleSheet>`;
    const texto = (s) => Buffer.from(s, 'utf8');
    return escribirZip([
        {
            nombre: '[Content_Types].xml',
            datos: texto(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
        },
        {
            nombre: '_rels/.rels',
            datos: texto(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
        },
        {
            nombre: 'xl/workbook.xml',
            datos: texto(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
        },
        {
            nombre: 'xl/_rels/workbook.xml.rels',
            datos: texto(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
        },
        { nombre: 'xl/styles.xml', datos: texto(estilos) },
        { nombre: 'xl/worksheets/sheet1.xml', datos: texto(hojaXml) },
    ]);
}
