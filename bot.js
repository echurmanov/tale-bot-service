const mysql = require("mysql");
const Promise = require('bluebird');
const config = require("./config.json");
const http = require("http");
const url = require("url");
const Querystring = require("querystring");

const account = require("./src/account.js");

const dbPool = mysql.createPool({
  connectionLimit : 20,
  host            : config.share.db.host,
  user            : config.share.db.username,
  password        : config.share.db.password,
  database        : config.share.db.dbname
});

var accounts = [];
var users = {};

dbPool.getConnectionSync = Promise.promisify(dbPool.getConnection);

console.log("Loading configurations...");

dbPool.getConnectionSync()
  .then((conn)=> {
    conn.query({sql: "SELECT u.* FROM users u WHERE u.status = ?"}, ["ACTIVE"], (err, result, fields) => {
      if (err) {
        conn.release();
        console.log("ERROR", err);
        return;
      }
      for (let i = 0; i < result.length; i++) {
        users[result[i]['user_id']] = result[i];
        users[result[i]['user_id']].accounts = new Array();
      }
      conn.query({sql: "SELECT ar.* FROM auth_requests ar left join users u on ar.user_id = u.user_id WHERE u.status = ?"}, ["ACTIVE"], (err, result, fields) => {
        conn.release();
        if (err) {
          console.log("ERROR", err);
          return;
        }
        for (let i = 0; i < result.length; i++) {
          let acc = new account.Account();
          acc.sessionid = result[i].sessionid;
          acc.csrftoken = result[i].csrftoken;
          acc.authState = result[i].state;
          acc.id = result[i].token_id;
          accounts.push(acc);
          if (acc.authState != account.AUTH.AUTH_REJECTED) {
            acc.checkAuth().then((authData) => {
              authData.account.setAuthState(authData.state);
            });
          }
          acc.on(account.EVENTS.AUTH_STATE_CHANGED, updateAccountInDb);
          acc.on(account.EVENTS.CHANGE_CREDENTIALS, updateAccountInDb);
          acc._user = users[result[i].user_id];
          users[result[i].user_id].accounts.push(acc);
        }
        console.log(users);
        startHttpServer();
      });

    });
  })
  .catch((error) => {
    console.log("ERROR GET CONNECTION", error);
  });


function updateAccountInDb(acc) {
  if (!(acc instanceof account.Account)) {
    throw new Error("Wrong param");
  }
  dbPool.getConnectionSync().then((conn) => {
    let insertData = [
      acc.sessionid,
      acc.csrftoken,
      acc.authState,
      new Date(),
      acc.id
    ];

    conn.query("UPDATE auth_requests SET sessionid = ?, csrftoken = ?, state = ?, updateDate = ?  WHERE token_id = ?", insertData, (err) => {
      conn.release();
      if (err) {
        console.log("DB Error: ", err);
        return;
      }
      console.log("Update request in DB");
    });
  });

}


function createAuthRequest(params, res) {
  if (typeof params['user_id'] !== 'undefined' && typeof users[params['user_id']] != 'undefined') {
    let acc = new account.Account();
    acc.requestAuth(params['device'])
      .then((data) => {
        let parts = data.authPage.split('/');
        acc.id = parts.pop();
        dbPool.getConnectionSync().then((conn) => {
          let insertData = {
            token_id: acc.id,
            user_id: params['user_id'],
            sessionid: acc.sessionid,
            csrftoken: acc.csrftoken,
            state: acc.authState,
            updateDate: new Date()
          };
          conn.query("INSERT INTO auth_requests SET ?", insertData, (err) => {
            conn.release();
            if (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "text/json");
              res.write(JSON.stringify({ "success": false, "error": err.message }));
              res.end();
              return;
            }
            accounts.push(acc);
            users[params['user_id']].accounts.push(acc);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/json");
            res.write(JSON.stringify({ "success": true, "auth_page": ["http://the-tale.org", data.authPage].join('') }));
            res.end();
          });
        });
      })
      .catch((error) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/json");
        res.write(JSON.stringify({ "success": false, "error":error.message }));
        res.end();
      });

  } else {
    res.setHeader("Content-Type", "text/json");
    res.write(JSON.stringify({ "success": false, "error":"User not found" }));
    res.end();
  }
}


function startHttpServer() {
  console.log("Starting HTTP server");
  var server = http.createServer(function(req, res){
    var urlData = url.parse(req.url);
    console.log(urlData);
    switch (urlData.pathname) {
      case '/create-request':
        createAuthRequest(Querystring.parse(urlData.query), res);
        break;
      default:
        res.statusCode = 404;
        res.end();
    }

  });
  server.once('listening', () => {
    console.log(["HTTP server started at ",config.bot.host,":",config.bot.port].join(''));
  });
  server.listen(config.bot.port, config.bot.host);
}