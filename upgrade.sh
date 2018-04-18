#!/bin/bash

git fetch --all && git reset --hard origin/master
npm install
killall node
node app.js >log.txt