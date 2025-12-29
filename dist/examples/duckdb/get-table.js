"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../src");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    // DuckDB обычно использует path как descriptor
    const ticket = new TextEncoder().encode('SELECT * FROM my_table');
    const table = await (0, src_1.doGetTable)(client, ticket);
    console.log(table.toString());
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=get-table.js.map