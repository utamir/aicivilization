#!/bin/sh
cd "$(dirname "$0")" || exit 1
./RUN_NO_NODE.sh
STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo
  echo "Press Enter to close..."
  read _x
fi
exit $STATUS
