"use strict";

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

var gameAccounts = {};

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
          acc.controlEnabled = result[i].controlStatus;
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
      acc.accountId,
      acc.id
    ];

    conn.query("UPDATE auth_requests SET sessionid = ?, csrftoken = ?, state = ?, updateDate = ?, account_id = ?  WHERE token_id = ?", insertData, (err) => {
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
            updateDate: new Date(),
            account_id: acc.accountId,
            controlStatus: true
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

function loadUser(userId, req) {
  if (typeof users[userId] == 'undefined') {
    dbPool.getConnectionSync().then((conn) => {
      conn.query("SELECT * FROM users WHERE user_id = ?", [userId], function(error,results){
        if (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/json");
          res.write(JSON.stringify({ "success": false, "error": err.message }));
          res.end();
          return;
        }
        if (results.length > 0) {
          users[results[0]['user_id']] = results[0];
          users[results[0]['user_id']].accounts = new Array();
          conn.query("SELECT * FROM auth_requests  WHERE user_id = ?", [userId], function(err,results){
            conn.release();
            if (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "text/json");
              res.write(JSON.stringify({"success": false, "error": err.message}));
              res.end();
              return;
            }
            for (let i = 0; i < results.length; i++) {
              let acc = new account.Account();
              acc.sessionid = results[i].sessionid;
              acc.csrftoken = results[i].csrftoken;
              acc.authState = results[i].state;
              acc.controlEnabled = results[i].controlStatus;
              acc.id = results[i].token_id;
              accounts.push(acc);
              if (acc.authState != account.AUTH.AUTH_REJECTED) {
                acc.checkAuth().then((authData) => {
                  authData.account.setAuthState(authData.state);
                });
              }
              acc.on(account.EVENTS.AUTH_STATE_CHANGED, updateAccountInDb);
              acc.on(account.EVENTS.CHANGE_CREDENTIALS, updateAccountInDb);
              acc._user = users[results[i].user_id];
              users[results[i].user_id].accounts.push(acc);
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/json");
            res.write(JSON.stringify({"success": true}));
            res.end();
          });
        }
      });

    }).catch((error) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/json");
      res.write(JSON.stringify({ "success": false, "error":error.message }));
      res.end();
    })
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
      case '/load-user':
        let params = Querystring.parse(urlData.query);
        loadUser(params["userId"], res);
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

const rule = require("./src/rule.js");

var botConfig = new (require("./src/bot-config"))();

botConfig.addRules([
  new rule.Rule(rule.PARAM.HERO_TOTAL_ENERGY, rule.REL.GREATER, 20),
  new rule.Rule(rule.PARAM.HERO_ACTION, rule.REL.IS, 0),
  new rule.Rule(rule.PARAM.HERO_ACTION_PERCENT, rule.REL.GREATER, 0),
  new rule.Rule(rule.PARAM.HERO_ACTION_PERCENT, rule.REL.LOWER, 1)
]);

botConfig.addRules([
  new rule.Rule(rule.PARAM.HERO_ENERGY_BONUS, rule.REL.GREATER, 5000),
  new rule.Rule(rule.PARAM.HERO_ACTION, rule.REL.IS, 2),
  new rule.Rule(rule.PARAM.HERO_ACTION_PERCENT, rule.REL.GREATER, 0),
  new rule.Rule(rule.PARAM.HERO_ACTION_PERCENT, rule.REL.LOWER, 1)
]);



/**
 *
 * @param {Account} acc
 * @param status
 */
function processStatus(acc, status) {
  if (botConfig.checkNeedHelp(status)) {
    acc.sendHelp()
      .then((data) => {
        console.log("HELP SUCCESS");
      })
      .catch((error) => {
        console.log("ERROR ON HELP")
      });
  }
  if (botConfig.takeCard(status)) {
    acc.sendHelp()
      .then((data) => {
        console.log("NEW CARD", data);
      })
      .catch((error) => {
        console.log("ERROR ON TAKE KARD")
      });
  }
}

/**
 *
 * @param {account.Account[]} accounts
 * @param {Number} turn
 */
function processAccounts(accounts, turn) {
  console.log("PROCESS");
  for (let i = 0; i < accounts.length; i++) {
    let acc = accounts[i];
    if (acc.controlEnabled && acc.authState == account.AUTH.AUTH_SUCCESS) {
      acc.getStatus().then((data) => {
        processStatus(data.account, data);
      }).catch((error) => {
        console.error("Get STATUS ERROR", error);
      });
    }
  }
}

var checkAccount = new account.Account();

var lastTurn = 0;
setInterval(function(){
  checkAccount.getStatus().then((status) => {
    if (typeof status.turn !== 'undefined' && status.turn != null) {
      if (lastTurn != status.turn.number) {
        setTimeout(function(){processAccounts(accounts, status.turn.turn);}, 3000);
      }
      lastTurn = status.turn.number;
    }
  }).catch((error) => {
    console.log("ERRO ON CHECK TURN", error);
  });
}, 3000);