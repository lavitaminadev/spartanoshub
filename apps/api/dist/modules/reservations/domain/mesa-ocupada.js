"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.condicionDeSolape = condicionDeSolape;
function condicionDeSolape(alias) {
    return `${alias}.starts_at < :endsAt AND (CASE
      WHEN ${alias}.status = 'attended' AND ${alias}.left_at IS NULL THEN GREATEST(${alias}.ends_at, :ahoraOcupacion)
      ELSE ${alias}.ends_at
    END) > :startsAt`;
}
