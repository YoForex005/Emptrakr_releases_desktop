const fs = require('fs');
const pngToIco = require('png-to-ico');

pngToIco('build/icon.png')
  .then(buf => {
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Successfully generated build/icon.ico');
  })
  .catch(console.error);
