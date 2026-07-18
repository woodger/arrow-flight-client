import json

import pyarrow as pa
import pyarrow.flight as flight


large_row_count = 700_000


class IncomingHeadersMiddleware(flight.ServerMiddleware):
    def __init__(self, headers):
        self.headers = headers

    def sending_headers(self):
        return {}

    def call_completed(self, exception):
        pass


class IncomingHeadersMiddlewareFactory(flight.ServerMiddlewareFactory):
    def start_call(self, info, headers):
        return IncomingHeadersMiddleware(headers)


class CompatibilityServer(flight.FlightServerBase):
    def __init__(self):
        super().__init__(
            "grpc://127.0.0.1:0",
            middleware={"incoming_headers": IncomingHeadersMiddlewareFactory()},
        )

    def do_action(self, context, action):
        if action.type != "read-authorization":
            raise NotImplementedError(action.type)

        middleware = context.get_middleware("incoming_headers")
        values = middleware.headers.get("authorization", [])
        value = values[0] if values else ""

        if isinstance(value, str):
            value = value.encode("utf-8")

        return [flight.Result(value)]

    def do_get(self, context, ticket):
        if ticket.ticket != b"large-record-batch":
            raise KeyError(ticket.ticket)

        values = pa.array([1.25] * large_row_count, type=pa.float64())
        table = pa.Table.from_arrays([values], names=["value"])
        return flight.RecordBatchStream(table)

    def do_put(self, context, descriptor, reader, writer):
        batch_count = 0
        row_count = 0
        metadata = []
        events = []

        while True:
            try:
                chunk = reader.read_chunk()
            except StopIteration:
                break

            if chunk.data is not None:
                batch_count += 1
                row_count += chunk.data.num_rows
                events.append("batch")

            if chunk.app_metadata is not None:
                metadata.append(chunk.app_metadata.to_pybytes().decode("utf-8"))
                events.append("metadata")

        result = json.dumps({
            "batchCount": batch_count,
            "rowCount": row_count,
            "metadata": metadata,
            "events": events,
        }).encode("utf-8")
        writer.write(pa.py_buffer(result))


if __name__ == "__main__":
    server = CompatibilityServer()
    print(json.dumps({"port": server.port}), flush=True)
    server.serve()
