#!/usr/bin/env sh
set -eu

exec npm exec --offline -- tsx scripts/migrate.ts
