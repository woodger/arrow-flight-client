# Examples — Apache Arrow Flight Client (Node.js)

This directory contains runnable examples demonstrating how to use
the Arrow Flight client with common `Flight servers`.

## Prerequisites

- Node.js >= 18
- Python >= 3.9 (for PyArrow examples)
- Docker (for DuckDB example)

Install dependencies:

```bash
npm install
````

---

## 1. PyArrow Flight Server

Start a local PyArrow Flight server:

```bash
cd pyarrow-server
python server.py
```

Server will listen on `localhost:8815`.

---

## 2. List Flights

```bash
npx ts-node list-flights.ts
```

---

## 3. Fetch Arrow Table (DoGet)

```bash
npx ts-node get-table.ts
```

---

## 4. Upload Arrow Table (DoPut)

```bash
npx ts-node put-table.ts
```

---

## 5. DuckDB Flight Example

```bash
cd duckdb
docker compose up
npx ts-node get-table.ts
```
