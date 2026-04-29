const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('572811Egx@', 10);
console.log(hash);
