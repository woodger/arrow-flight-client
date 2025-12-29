#!/bin/bash

# Build TS services from proto files.
# See: https://github.com/stephenh/ts-proto
# Usage: ./compile-proto.sh

protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --proto_path=./contracts \
  --ts_proto_out=./src/generated \
  --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false \
  --ts_proto_opt="env=node" \
  --ts_proto_opt="esModuleInterop=true" \
  ./contracts/*.proto
