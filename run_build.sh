#!/bin/bash
echo Repo is $1, branch is $3, commit is $4. 1>&2
if [ ! -d "$1" ]; then
  git clone --recursive $2 >/dev/null
fi
cd $1
git clean -fdx >/dev/null
git fetch >/dev/null
git checkout $3 >/dev/null
git checkout $4 >/dev/null
make enclave-hash
