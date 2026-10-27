"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarJuegos = validarJuegos;
exports.asegurarQueNoConcedePorEncima = asegurarQueNoConcedePorEncima;
exports.datosSubieron = datosSubieron;
const common_1 = require("@nestjs/common");
const shared_1 = require("@espartanos/shared");
const RANGO_DE_DATOS = { oculto: 0, bajo_registro: 1, directo: 2 };
function validarJuegos(areas, datos) {
    for (const [clave, nivel] of Object.entries(areas)) {
        const definicion = (0, shared_1.definicionDeArea)(clave);
        if (!definicion)
            throw new common_1.BadRequestException(`El área «${clave}» no existe`);
        if (!definicion.niveles.includes(nivel)) {
            throw new common_1.BadRequestException(`El área «${definicion.nombre}» no admite el nivel «${nivel}»`);
        }
    }
    for (const [modulo, nivel] of Object.entries(datos)) {
        if (!(0, shared_1.tieneDatosProtegidos)(modulo)) {
            throw new common_1.BadRequestException(`El módulo «${modulo}» no tiene datos protegidos que repartir`);
        }
        if (!shared_1.NIVELES_DE_DATOS.includes(nivel)) {
            throw new common_1.BadRequestException(`El nivel de datos «${String(nivel)}» no existe`);
        }
    }
}
function asegurarQueNoConcedePorEncima(tope, areas, datos) {
    if (tope === null)
        return;
    for (const [clave, nivel] of Object.entries(areas)) {
        if (nivel === 'ninguno')
            continue;
        if (!(0, shared_1.alcanza)((0, shared_1.nivelEfectivo)(tope.areas, {}, clave), nivel)) {
            const nombre = (0, shared_1.definicionDeArea)(clave)?.nombre ?? clave;
            throw new common_1.ForbiddenException(`No puedes dar «${nombre}» en nivel «${nivel}»: es más de lo que tú tienes`);
        }
    }
    for (const [modulo, nivel] of Object.entries(datos)) {
        if (RANGO_DE_DATOS[nivel] > RANGO_DE_DATOS[(0, shared_1.datosEfectivos)(tope.datos, {}, modulo)]) {
            throw new common_1.ForbiddenException(`No puedes dar ese nivel de datos protegidos en «${modulo}»: es más de lo que tú tienes`);
        }
    }
}
function datosSubieron(antes, despues, modulo) {
    return RANGO_DE_DATOS[despues[modulo] ?? 'oculto'] > RANGO_DE_DATOS[antes[modulo] ?? 'oculto'];
}
