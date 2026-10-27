"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isActivePieceStatus = exports.ACTIVE_PIECE_STATUS_SQL = void 0;
exports.ACTIVE_PIECE_STATUS_SQL = "status NOT IN ('delivered','cancelled')";
const isActivePieceStatus = (status) => status !== 'delivered' && status !== 'cancelled';
exports.isActivePieceStatus = isActivePieceStatus;
