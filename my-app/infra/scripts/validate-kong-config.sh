#!/bin/sh
set -eu

entrypoint=/home/kong/kong-entrypoint.sh
render_script=$(mktemp)
trap 'rm -f "$render_script"' EXIT

# Execute the exact production renderer without its final server start, then
# ask Kong to parse the resulting declarative configuration.
sed '$d' "$entrypoint" > "$render_script"
/bin/sh "$render_script"
kong config parse "$KONG_DECLARATIVE_CONFIG" >/dev/null
