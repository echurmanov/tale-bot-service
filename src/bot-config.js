"use strict";

const rule = require("./rule.js");


class BotConfig
{
  constructor () {
    this.sourceRules = [];
    this.helpConditions = [];
    this.autoTakeCard = true;
    this.autoCombineCards = {
      auction: false,
      not_auction: false
    };
    this.cardLimits = {};
  }

  /**
   *
   * @param {rule.Rule[]} rules
   */
  addRules(rules) {
    if (rules instanceof rule.Rule) {
      rules = [rules];
    }
    var condition = [];
    for (let i = 0; i < rules.length; i++) {
      condition.push(rules[i].toFunction());
    }
    this.sourceRules.push(rules);
    this.helpConditions.push(condition);
  }

  checkNeedHelp(status) {
    for (let i = 0; i < this.helpConditions.length; i++) {
      let help = true;
      for (let j = 0; j < this.helpConditions[i].length && help; j++) {
        help = help && this.helpConditions[i][j](status);
      }
      if (help) {
        return true;
      }
    }
    return false;
  }

  takeCard(status) {
    return this.autoTakeCard && status.help.count >= status.help.barrier;
  }

  combineCard(status) {
    var auctionList = [];
    var notAuctionList = [];
    if (!this.autoCombineCards.auction && !this.autoCombineCards.not_auction) {
      return [];
    }
    for (let rarity = 0; rarity <= 4; rarity++) {
      auctionList = [];
      notAuctionList = [];
      for (let cardType in status.cards[rarity]) {
        for (let cardName in status.cards[rarity][cardType]) {
          if (typeof this.cardLimits[cardName] !== 'undefined') {
            let copyAuc = status.cards[rarity][cardType][cardName].auction.slice(0);
            let copyNotAuc = status.cards[rarity][cardType][cardName].not_auction.slice(0);
            let totalCardHave = copyAuc.length
              + copyNotAuc.length;
            while (this.autoCombineCards.auction && this.cardLimits[cardName] < (totalCardHave) && copyAuc.length > 0 && auctionList.length < 3) {
              auctionList.push(copyAuc.shift());
            }
            copyAuc = status.cards[rarity][cardType][cardName].auction.slice(0);
            copyNotAuc = status.cards[rarity][cardType][cardName].not_auction.slice(0);
            totalCardHave = copyAuc.length
              + copyNotAuc.length;
            while (this.autoCombineCards.not_auction && this.cardLimits[cardName] < (totalCardHave) && copyNotAuc.length > 0 && notAuctionList.length < 3) {
              notAuctionList.push(copyNotAuc.shift());
            }
            if ((rarity == 4 && auctionList.length >=2) || auctionList.length == 3) {
              if (rarity == 4) {
                return auctionList.slice(0,2);
              } else {
                return auctionList;
              }
            }
            if ((rarity == 4 && notAuctionList.length >=2) || notAuctionList.length == 3) {
              if (rarity == 4) {
                return notAuctionList.slice(0,2);
              } else {
                return notAuctionList;
              }
            }
          }
        }
      }
    }
    return [];
  }
}

module.exports = BotConfig;
