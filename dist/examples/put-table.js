"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const apache_arrow_1 = require("apache-arrow");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const table = (0, apache_arrow_1.tableFromArrays)({
        id: [4, 5, 6],
        name: ['Dave', 'Eve', 'Frank']
    });
    await (0, src_1.doPutTable)(client, table, ['uploaded', 'table']);
    console.log('Table uploaded');
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=put-table.js.map