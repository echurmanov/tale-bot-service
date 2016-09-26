"use strict";

const Promise = require("bluebird");
const Querystring = require('querystring');
const EventEmitter = require('events');

const Request = require ('./utils.js').PromiseRequest;
const TokenGenerator = require ('./utils.js').TokenGenerator;
const ParseCookies = require ('./utils.js').ParseCookies;

const CLIENT_NAME = "CrazyNigerBotService";
const CLIENT_VERSION = "v0.1.0";
const HOST = 'the-tale.org';

const AUTH_NONE = 'AUTH_NONE';
const AUTH_WAIT = 'AUTH_WAIT';
const AUTH_SUCCESS = 'AUTH_SUCCESS';
const AUTH_REJECTED = 'AUTH_REJECTED';

const EVENTS = {
  CHANGE_CREDENTIALS: 'CHANGE_CREDENTIALS',
  AUTH_CONFIRMED: 'AUTH_CONFIRMED',
  AUTH_STATE_CHANGED: 'AUTH_STATE_CHANGED'
};

const ABILITY = {
  HELP: 'help',
  BUILDING_REPAIR: 'building_repair',
  DROP_ITEM: 'drop_item'
};

const RESPONSE_STATUS = {
  OK: 'ok',
  PROCESSING: 'processing',
  ERROR: 'error'
};

const CHECK_PROCESS_STATUS_DELAY = 500;


class Account extends EventEmitter{
  constructor()
  {
    super();
    this.id = null;
    this.sessionid = null;
    this.csrftoken = null;
    this.lastState = null;
    this.accountId = null;
    this.accountName = null;
    this.controlEnabled = null;
    this.sessionExpireAt = null;
    this.authState = AUTH_NONE;
  }

  apiRequest(apiUrl, method, version, getParams, postParams) {
    return new Promise((resolve, reject) => {
      if (this.csrftoken == null) {
        this.csrftoken = TokenGenerator();
      }
      var encodedPostData;
      if (typeof postParams !== 'undefined') {
        encodedPostData = Querystring.stringify(postParams);
      }
      var cookies = [['csrftoken=',this.csrftoken].join('')];
      if (this.sessionid) {
        cookies.push(['sessionid=', this.sessionid].join(''));
      }
      var path = [apiUrl];
      if (typeof getParams == 'undefined') {
        getParams = {};
      }
      if (typeof version !== 'undefined') {
        getParams['api_version'] = version;
      }
      getParams['api_client'] = [CLIENT_NAME, CLIENT_VERSION].join('-');
      path.push(Querystring.stringify(getParams));

      var options = {
        hostname: HOST,
        port: 80,
        path: path.join('?'),
        method: method.toLowerCase()=='post'?'POST':'GET',
        headers: {
          'Cookie': cookies.join(' '),
          'X-CSRFToken': this.csrftoken
        }
      };
      if (encodedPostData) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.from(encodedPostData).length;
      }
      var request = new Request(options, encodedPostData);
      request.then((response) => {
        if (response.httpStatusCode == 200) {
          let bodyData = {};
          try {
            bodyData = JSON.parse(response.body);
          } catch (error) {
            reject(new Error(['Can\'t parse response as json:', error.message].join(' ')));
            return;
          }
          if (typeof bodyData.status !== 'undefined') {
            switch (bodyData.status) {
              case RESPONSE_STATUS.PROCESSING:
                setTimeout(() => {
                  this.apiRequest(bodyData.status_url, 'GET').then((data)=>resolve(data)).catch((error)=>reject(error));
                }, CHECK_PROCESS_STATUS_DELAY);
                break;
              case RESPONSE_STATUS.OK:
                if (typeof response.headers['set-cookie'] !== 'undefined') {
                  let oldToken = this.csrftoken;
                  let oldSession = this.sessionid;
                  let cookies = ParseCookies(response.headers['set-cookie']);
                  if (typeof cookies['csrftoken'] !== 'undefined') {
                    this.csrftoken = cookies['csrftoken'];
                  }
                  if (typeof cookies['sessionid'] !== 'undefined') {
                    this.sessionid = cookies['sessionid'];
                  }
                  if (oldSession != this.sessionid || oldToken != this.csrftoken) {
                    this.emit(EVENTS.CHANGE_CREDENTIALS, this);
                  }
                }
                resolve(bodyData.data);
                break;
              case RESPONSE_STATUS.ERROR:
                reject(new Error(bodyData.error));
                break;
              default:
                reject(new Error(['Unknown response status: ', response.body].join()));
                break;
            }
          } else {
            reject(new Error(['Unexpected response: ', response.body].join()));
          }
        } else {
          reject(new Error(['Wrong request response code:', response.httpStatusCode].join(' ')));
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  setAuthState (newState) {
    var changed = newState !== this.authState;
    this.authState = newState;
    if (changed) {
      this.emit(EVENTS.AUTH_STATE_CHANGED, this, newState);
    }
  }

  requestAuth(device) {
    return new Promise((resolve, reject) => {
      var url = '/accounts/third-party/tokens/api/request-authorisation';
      var version = '1.0';
      var params = {
        "application_name": CLIENT_NAME,
        "application_description": "Сервис ботов от CrazyNiger'а. Автоматизация помощи и выбора в квестах, взятия и объеденения карт."
      };
      if (typeof device != 'undefined') {
        params['application_info'] = device;
      }
      var request = this.apiRequest(url, 'POST', version, {}, params);
      request.then((bodyData) => {
        resolve({account: this, authPage: bodyData.authorisation_page});
      }).catch((error) => {
        reject(error);
      })
    });
  }

  checkAuth () {
    return new Promise((resolve, reject) => {
      var url = '/accounts/third-party/tokens/api/authorisation-state';
      var version = '1.0';
      var request = this.apiRequest(url, 'GET', version);

      request.then((bodyData) => {
        switch (bodyData.state) {
          case 1:
            this.setAuthState(AUTH_WAIT);
            resolve({account: this, state: AUTH_WAIT});
            break;
          case 2:
            var wasNull = this.accountId == null;
            this.accountId = bodyData.account_id;
            this.accountName = bodyData.account_name;
            this.sessionExpireAt = bodyData.session_expire_at;
            if (wasNull) {
              this.emit(EVENTS.AUTH_CONFIRMED, this);
            }
            this.setAuthState(AUTH_SUCCESS);
            resolve({account: this, state: AUTH_SUCCESS});
            break;
          case 3:
            this.setAuthState(AUTH_REJECTED);
            resolve({account: this, state: AUTH_REJECTED});
            break;
          default:
            this.setAuthState(AUTH_NONE);
            resolve({account: this, state: AUTH_REJECTED});
            break;
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }


  getStatus() {
    return new Promise((resolve, reject) => {
      var url = '/game/api/info';
      var version = '1.5';
      var request = this.apiRequest(url, 'GET', version);

      request.then((bodyData) => {
        var status = {};
        status.account = this;
        if (bodyData.account != null) {
          status.cards = {
            '0': {},
            '1': {},
            '2': {},
            '3': {},
            '4': {}
          };
          for (let i = 0; i < bodyData.account.hero.cards.cards.length; i++) {
            let card = bodyData.account.hero.cards.cards[i];
            if (typeof status.cards[card.rarity] === 'undefined') {
              status.cards[card.rarity] = {};
            }
            if (typeof status.cards[card.rarity][card.type] === 'undefined') {
              status.cards[card.rarity][card.type] = {};
            }
            if (typeof status.cards[card.rarity][card.type][card.name] === 'undefined') {
              status.cards[card.rarity][card.type][card.name] = {
                "auction": [],
                "not_auction": []
              };
            }
            if (card.auction) {
              status.cards[card.rarity][card.type][card.name].auction.push(card.uid);
            } else {
              status.cards[card.rarity][card.type][card.name].not_auction.push(card.uid);
            }
          }

          status.help = {
            "help_barrier": bodyData.account.hero.cards.help_barrier,
            "help_count": bodyData.account.hero.cards.help_count
          };
          status.game_state = bodyData.game_state;
          status.mode = bodyData.mode;
          status.base = bodyData.account.hero.base;
          status.base.health_percent = status.base.health / status.base.max_health;
          status.energy = bodyData.account.hero.energy;
          status.energy.total = status.energy.value + status.energy.bonus;
          status.quests = bodyData.account.hero.quests;
          status.action = bodyData.account.hero.action;
          status.companion = bodyData.account.hero.companion;
          status.turn = bodyData.turn;
          resolve(status);
        } else {
          status.game_state = -1;
          status.cards = {
            '0': {},
            '1': {},
            '2': {},
            '3': {},
            '4': {}
          };
          status.mode = null;
          status.base = null;
          status.energy = null;
          status.quests = null;
          status.action = null;
          status.companion = null;
          status.turn = bodyData.turn;
          resolve(status);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  useAbility(abilty) {
    return new Promise((resolve, reject) => {
      var url = ['/game/abilities/',abilty,'/api/use'].join('');
      var version = '1.0';
      var request = this.apiRequest(url, 'POST', version);

      request.then((bodyData) => {
        resolve(bodyData);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  sendHelp() {
    return new Promise((resolve, reject) => {
      this.useAbility(ABILITY.HELP)
        .then((data)=>{
          resolve();
        })
        .catch((error)=>reject(error));
    });
  }

  takeCard() {
    return new Promise((resolve, reject) => {
      var url = '/game/cards/api/get';
      var version = '1.0';
      var request = this.apiRequest(url, 'POST', version);
      request.then((bodyData) => {
        resolve(bodyData.card);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  combineCard(cardIds) {
    return new Promise((resolve, reject) => {
      var url = '/game/cards/api/combine';
      var version = '1.0';
      var params = {
        "cards": cardIds.join(",")
      };
      var request = this.apiRequest(url, 'POST', version, params);
      request.then((bodyData) => {
        resolve(bodyData.card_ui_info);
      }).catch((error) => {
        reject(error);
      });
    });
  }

}

module.exports = {
  Account: Account,
  ABILITY: ABILITY,
  AUTH: {
    AUTH_NONE: AUTH_NONE,
    AUTH_SUCCESS: AUTH_SUCCESS,
    AUTH_WAIT: AUTH_WAIT,
    AUTH_REJECTED: AUTH_REJECTED
  },
  EVENTS: EVENTS
};







