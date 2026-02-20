#!/bin/bash -e

if [ "$UID" -eq 0 ]; then
  set +e # disable failing on errror
  ulimit -n 65535
  echo "NEW ULIMIT: $(ulimit -n)"
  set -e # enable failing on error
else
  echo ENTRYPOINT DID NOT RUN AS ROOT
fi

if [ "$FLY_PROCESS_GROUP" = "app" ]; then
  echo "RUNNING app"
  bun run start
elif [ "$FLY_PROCESS_GROUP" = "workers" ]; then
  echo "RUNNING worker"
  bun run worker
else
  echo "NO FLY PROCESS GROUP"
  bun run start
fi