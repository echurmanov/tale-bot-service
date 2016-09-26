"use strict";

const rule = require("./rule.js");


class BotConfig
{
  constructor () {
    this.helpConditions = [];
    this.autoTakeCard = true;
    this.autoCombineCards = {
      auction: true,
      not_auction: true
    };
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
    return false;
  }
}

module.exports = BotConfig;
