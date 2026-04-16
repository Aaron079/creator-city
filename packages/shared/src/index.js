"use strict";
// ─── Creator City — Shared Package ───────────────────────────────────────────
//
// Import from canonical type files (no .types.ts suffix).
// The .types.ts files exist only for backwards compat and re-export from here.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Domain types
__exportStar(require("./types/agent"), exports);
__exportStar(require("./types/task"), exports);
__exportStar(require("./types/asset"), exports);
__exportStar(require("./types/project"), exports);
// Supporting types (unchanged — still canonical)
__exportStar(require("./types/user.types"), exports);
__exportStar(require("./types/city.types"), exports);
__exportStar(require("./types/socket.types"), exports);
//# sourceMappingURL=index.js.map