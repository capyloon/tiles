#!/bin/bash

pushd $1
w3 put ./ --no-wrap |grep -v http|grep bafy > ../$1.cid
popd

echo "Published with CID `cat $1.cid`"

