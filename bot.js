"use strict";

const Promise = require("bluebird");
const Querystring = require('querystring');

const Request = require ('./src/utils.js').PromiseRequest;
const TokenGenerator = require ('./src/utils.js').TokenGenerator;

const CLIENT_NAME = "CrazyNigerBotService";
const CLIENT_VERSION = "v0.1.0";
const HOST = 'the-tale.org';




class Account {
  constructor()
  {
    this.sessionid = null;
    this.crfstoken = null;
    this.lastState = null;
    this.accountId = null;
    this.accountName = null;
  }

  _requestAuth(resolve, reject) {
    console.log("REQ");
    console.log(this);
    if (this.crfstoken == null) {
      this.crfstoken = TokenGenerator();
    }
    var data = {
      "application_name": CLIENT_NAME,
      "application_description": "Сервис ботов от CrazyNiger'а. Автоматизация помощи и выбора в квестах для прокачки черт.",
      "application_info": "Из Браузера"
    };
    var encodedData = Querystring.stringify(data);
    var options = {
      hostname: HOST,
      port: 80,
      path: '/accounts/third-party/tokens/api/request-authorisation?api_version=1.0&api_client=' + [CLIENT_NAME, CLIENT_VERSION].join("-"),
      method: 'POST',
      headers: {
        'Content-Length': Buffer.from(encodedData).length,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': 'csrftoken=' + this.crfstoken,
        'X-CSRFToken': this.crfstoken
      }
    };
    Request(options, encodedData).then(function(data){

    }).catch(function(error){

    });
  }

  requestAuth() {
    return new Promise(this._requestAuth.bind(this));
  }

}



var account = new Account();

var auth = account.requestAuth().then(function(response){
  console.log("Response", response);
}).catch(function(error){
  console.log("Request Error", error);
});






