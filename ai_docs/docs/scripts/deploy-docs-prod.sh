#!/bin/bash
echo "env: $VERCEL_ENV"

# Check if the commit message contains "chore: version - enter prerelease mode"
# or contains "fix(docs)"
# and only build the docs if it does
# reference: https://vercel.com/guides/how-do-i-use-the-ignored-build-step-field-on-vercel#with-a-script
commit_message=$(git log -1 --pretty=%B)

if [[ "$VERCEL_ENV" == "production" ]]; then
  if [[ ${commit_message,,} = "chore: version - enter prerelease mode" ]] || [[ ${commit_message,,} == *"fix(docs)"* ]]; then
    echo "✅ - Build can proceed"
    exit 1;
  else
    echo "🛑 - Build cancelled"
    exit 0;
  fi
fi

if git diff --quiet HEAD^ HEAD -- ./docs; then
  echo "🛑 - No changes in docs folder, build cancelled"
  exit 0;
fi

echo "✅ - Build can proceed"
exit 1;
