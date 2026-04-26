const fs = require('fs');
fetch('https://verdinha.wtf/assets/index-0PA2-Lrc.js')
  .then(r => r.text())
  .then(js => {
    const endpoints = js.match(/\/[-a-zA-Z0-9_\/]*search[-a-zA-Z0-9_\/]*/gi) || js.match(/\/[-a-zA-Z0-9_\/]*obras[-a-zA-Z0-9_\/]*/gi) || js.match(/\/[-a-zA-Z0-9_\/]*titulo[-a-zA-Z0-9_\/]*/gi) || js.match(/\/[-a-zA-Z0-9_\/]*manga[-a-zA-Z0-9_\/]*/gi);
    if (endpoints) {
      console.log([...new Set(endpoints)].slice(0, 30));
    } else {
      console.log('none found');
    }
  });