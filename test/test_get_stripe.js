const fs = require('fs');
const { processRequest } = require('./get_stripe');

async function main() {
  const token = fs.readFileSync('token.txt', 'utf8').trim();

  const result = await processRequest(token, true); // true=Plus, false=Team

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);