#!/usr/bin/env sh

echo "#### Running database migrations ####"
npx drizzle-kit migrate

echo "#### Starting DoKoHub ####"
node build
