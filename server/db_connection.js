require('babel-polyfill');
const mysql = require('mysql');
const pool  = mysql.createPool({
  connectionLimit : 10,
  host: 'localhost',
  port: 3306,
  user: 'root',
  password : '',
  database: 'newsdemo',
});

const query = (sql)=>{
  return new Promise((resolve, reject)=>{
    return pool.query(sql, (error, results, fields)=>{
      if(error)  resolve(error, fields);
      resolve(results, fields);
    })
  })
}

module.exports.query = query;
module.exports.escape = mysql.escape;