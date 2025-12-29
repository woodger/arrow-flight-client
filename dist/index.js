"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlightInfo = exports.listFlights = exports.doPutTable = exports.doGetTable = exports.FlightClient = void 0;
var FlightClient_1 = require("./client/FlightClient");
Object.defineProperty(exports, "FlightClient", { enumerable: true, get: function () { return FlightClient_1.FlightClient; } });
var DoGet_1 = require("./client/DoGet");
Object.defineProperty(exports, "doGetTable", { enumerable: true, get: function () { return DoGet_1.doGetTable; } });
var DoPut_1 = require("./client/DoPut");
Object.defineProperty(exports, "doPutTable", { enumerable: true, get: function () { return DoPut_1.doPutTable; } });
var Actions_1 = require("./client/Actions");
Object.defineProperty(exports, "listFlights", { enumerable: true, get: function () { return Actions_1.listFlights; } });
Object.defineProperty(exports, "getFlightInfo", { enumerable: true, get: function () { return Actions_1.getFlightInfo; } });
//# sourceMappingURL=index.js.map