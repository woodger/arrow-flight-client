"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlightInfo = exports.listFlights = exports.doPutTable = exports.doGetTable = exports.FlightClient = void 0;
var flight_client_1 = require("./client/flight-client");
Object.defineProperty(exports, "FlightClient", { enumerable: true, get: function () { return flight_client_1.FlightClient; } });
var do_get_1 = require("./client/do-get");
Object.defineProperty(exports, "doGetTable", { enumerable: true, get: function () { return do_get_1.doGetTable; } });
var do_put_1 = require("./client/do-put");
Object.defineProperty(exports, "doPutTable", { enumerable: true, get: function () { return do_put_1.doPutTable; } });
var actions_1 = require("./client/actions");
Object.defineProperty(exports, "listFlights", { enumerable: true, get: function () { return actions_1.listFlights; } });
Object.defineProperty(exports, "getFlightInfo", { enumerable: true, get: function () { return actions_1.getFlightInfo; } });
//# sourceMappingURL=index.js.map