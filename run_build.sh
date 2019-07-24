#!/bin/bash
echo Repo is $1, branch is $2, commit is $3.
HASH=`echo "$1/$2/$3" | sha1sum`
echo Computed hash is $HASH
