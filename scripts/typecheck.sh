#!/bin/bash
# TypeScript type check - only report errors in src/

OUTPUT=$(npx tsc --noEmit --skipLibCheck 2>&1)
TSC_EXIT=$?

# Filter only src/ errors
SRC_ERRORS=$(echo "$OUTPUT" | grep "^src/" || true)

if [ -n "$SRC_ERRORS" ]; then
    echo "$SRC_ERRORS"
    exit 1
fi

# No src/ errors found
exit 0
