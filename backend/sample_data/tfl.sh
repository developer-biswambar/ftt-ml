#!/bin/bash

# Exit on any error
set -e

echo "🔍 Running terraform plan to detect missing resources..."
PLAN_OUTPUT=$(mktemp)

# Generate plan and capture error output
if ! terraform plan -destroy -no-color > "$PLAN_OUTPUT" 2>&1; then
  echo "🧼 Checking for orphaned resources in state..."

  # Extract lines that indicate missing resources
  grep -E 'Error: .*: .*(NoSuchEntity|NotFound|cannot be found|does not exist|404)' "$PLAN_OUTPUT" |
  while read -r line; do
    # Try to extract the resource address (e.g., aws_instance.example)
    if [[ "$line" =~ ([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+) ]]; then
      resource="${BASH_REMATCH[1]}"
      echo "❌ Removing missing resource from state: $resource"
      terraform state rm "$resource"
    fi
  done

  echo "✅ Cleanup complete. You can now rerun terraform destroy."
else
  echo "✅ No missing resources detected. You can run terraform destroy safely."
fi

rm -f "$PLAN_OUTPUT"
