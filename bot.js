"use strict";

const mysql = require("mysql");
const Promise = require('bluebird');
const config = require("./config.json");
const http = require("http");
const url = require("url");
const Querystring = require("querystring");
const RULE = require("./src/rule.js");
const BotConfig = require("./src/bot-config.js")


const account = require("./src/account.js");

const dbPool = mysql.createPool({
  connectionLimit : 20,
  host            : config.share.db.host,
  user            : config.share.db.username,
  password        : config.share.db.password,
  database        : config.share.db.dbname
});

const Logger = require("./src/logger.js");
const logger = new Logger(dbPool);

var accounts = [];
var users = {};
var gameAccounts = {};
var botConfigurations = {};

dbPool.getConnectionSync = Promise.promisify(dbPool.getConnection);


loadBotConfigs();
function loadAccounts() {
  console.log("Loading accounts configurations ...");
  dbPool.getConnectionSync()
    .then((conn)=> {
      conn.query({ sql: "SELECT u.* FROM users u WHERE u.status = ?" }, ["ACTIVE"], (err, result, fields) => {
        if (err) {
          conn.release();
          console.log("ERROR", err);
          return;
        }
        for (let i = 0; i < result.length; i++) {
          users[result[i]['user_id']] = result[i];
          users[result[i]['user_id']].accounts = new Array();
        }
        conn.query({ sql: "SELECT ar.* FROM auth_requests ar left join users u on ar.user_id = u.user_id WHERE u.status = ?" }, ["ACTIVE"], (err, result, fields) => {
          conn.release();
          if (err) {
            console.log("ERROR", err);
            return;
          }
          for (let i = 0; i < result.length; i++) {
            let acc = new account.Account(logger);
            acc.sessionid = result[i].sessionid;
            acc.csrftoken = result[i].csrftoken;
            acc.authState = result[i].state;
            acc.controlEnabled = result[i].controlStatus;
            acc.accountName = result[i].account_name;
            acc.botConfigId = result[i].bot_config_id;
            if (typeof botConfigurations[acc.botConfigId] !== 'undefined') {
              acc.botConfig = botConfigurations[acc.botConfigId];
            }

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
          startHttpServer();
        });

      });
    })
    .catch((error) => {
      console.log("ERROR GET CONNECTION", error);
    });
}
function loadBotConfigs() {
  console.log("Loading bot configurations ...");
  dbPool.getConnectionSync()
    .then((conn)=> {
      let sql = [
        "SELECT * FROM bot_configs bc LEFT JOIN bot_config_blocks rule_block on rule_block.bot_config_id = bc.bot_config_id",
        "LEFT JOIN bot_config_block_rules rules on rules.config_block_id = rule_block.config_block_id"
      ].join(' ');
      conn.query(sql, (err, result) => {
        if (err) {
          conn.release();
          console.log("ERROR", err);
          return;
        }
        let ruleBlocks = {};
        for (let i = 0; i < result.length; i++) {
          if (result[i].config_block_id !== null) {
            if (typeof ruleBlocks[result[i].config_block_id] == 'undefined') {
              ruleBlocks[result[i].config_block_id] = {
                bot_config_id: result[i].bot_config_id,
                rules: []
              }
            }
            let rule = new RULE.Rule(result[i].param, result[i].rel, result[i].value);
            ruleBlocks[result[i].config_block_id].rules.push(rule);
          }
          if (typeof botConfigurations[result[i].bot_config_id] == 'undefined') {
            botConfigurations[result[i].bot_config_id] = new BotConfig();
            botConfigurations[result[i].bot_config_id].autoTakeCard = !!result[i].auto_take_cards;
            botConfigurations[result[i].bot_config_id].autoCombineCards.auction = !!result[i].auto_combine_auction;
            botConfigurations[result[i].bot_config_id].autoCombineCards.not_auction = !!result[i].auto_combine_auction;
          }
        }
        for (let idx in ruleBlocks) {
          if (typeof  botConfigurations[ruleBlocks[idx].bot_config_id] !== 'undefined') {
            botConfigurations[ruleBlocks[idx].bot_config_id].addRules(ruleBlocks[idx].rules);
          }
        }
        conn.query("SELECT * FROM bot_config_cards_limits", (err, result) => {
          conn.release();
          if (err) {
            console.log("ERROR", err);
            return;
          }
          for (let i = 0; i < result.length; i++) {
            if (typeof botConfigurations[result[i].bot_config_id] !== 'undefined') {
              botConfigurations[result[i].bot_config_id].cardLimits[result[i].card_name] = result[i].minimal_stack;
            }
          }
          loadAccounts();
        });

      });
    })
    .catch((error) => {
      console.log("ERROR GET CONNECTION", error);
    });
}

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
      acc.accountName,
      acc.botConfigId,
      acc.id
    ];

    conn.query("UPDATE auth_requests SET sessionid = ?, csrftoken = ?, state = ?, updateDate = ?, account_id = ?, account_name = ?, bot_config_id = ?  WHERE token_id = ?", insertData, (err) => {
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
    let acc = new account.Account(logger);
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
            account_name: acc.accountName,
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


function getUserAuthRequests(params, res) {
  if (typeof params['user_id'] !== 'undefined' && typeof users[params['user_id']] != 'undefined') {
    let user = users[params['user_id']];
    let accs = user.accounts;
    let result = [];
    for (let i = 0; i < accs.length; i++) {
      result.push({
        "id": accs[i].id,
        "accountId": accs[i].accountId,
        "accountName": accs[i].accountName,
        "authState": accs[i].authState,
        "controlState": accs[i].controlEnabled,
        "botConfig": accs[i].botConfigId
      });
    }
    console.log(result);
    res.setHeader("Content-Type", "text/json");
    res.write(JSON.stringify({"success": true, "accounts": result}));
    res.end();
  } else {
    res.setHeader("Content-Type", "text/json");
    res.write(JSON.stringify({ "success": false, "error":"User not found" }));
    res.end();
  }
}

function loadUser(userId, req) {
  if (typeof users[userId] == 'undefined') {
    dbPool.getConnectionSync().then((conn) => {
      conn.query("SELECT * FROM users WHERE user_id = ?", [userId], function(err,results){
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
              let acc = new account.Account(logger);
              acc.sessionid = results[i].sessionid;
              acc.csrftoken = results[i].csrftoken;
              acc.authState = results[i].state;
              acc.controlEnabled = results[i].controlStatus;
              acc.accountId = results[i].account_id;
              acc.accountName = results[i].account_name;
              acc.botConfigId = results[i].bot_config_id;
              if (typeof botConfigurations[acc.botConfigId] !== 'undefined') {
                acc.botConfig = botConfigurations[acc.botConfigId];
              }
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
      case '/get-user-requests':
        getUserAuthRequests(Querystring.parse(urlData.query), res);
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

/**
 *
 * @param {Account} acc
 * @param status
 */
function processStatus(acc, status) {
  if (acc.controlEnabled && typeof acc.botConfig != 'undefined') {
    if (acc.botConfig.checkNeedHelp(status)) {
      acc.sendHelp()
        .then((data) => {
          console.log("HELP SUCCESS");
          if (typeof acc.logger !== 'undefined') {
            acc.logger.logAction(acc.id, acc.accountId, new Date(), "HELP", status, data);
          }
        })
        .catch((error) => {
          console.log("ERROR ON HELP")
        });
    }
    if (acc.botConfig.takeCard(status)) {
      acc.takeCard()
        .then((data) => {
          if (typeof acc.logger !== 'undefined') {
            acc.logger.logAction(acc.id, acc.accountId, new Date(), "TAKE_CARD", status, data);
          }
          console.log("NEW CARD", data);
        })
        .catch((error) => {
          console.log("ERROR ON TAKE CARD")
        });
    }
    var combineCards = acc.botConfig.combineCard(status);
    console.log(combineCards);
    if (combineCards.length > 0) {
      acc.combineCard(combineCards).then((data)=> {
        if (typeof acc.logger !== 'undefined') {
          acc.logger.logAction(acc.id, acc.accountId, new Date(), "COMBINE_CARDS", status, data);
        }
        console.log("COMBINE SUCCESS", data);
      }).catch((error) => {
        console.log("COMBINE ERROR", error);
      })
    }
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
    } else if (acc.authState != account.AUTH.AUTH_SUCCESS && acc.authState != account.AUTH.AUTH_REJECTED) {
      acc.checkAuth();
    }
  }
}

var checkAccount = new account.Account(logger);

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