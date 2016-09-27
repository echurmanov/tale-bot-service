"use strict";

const PARAM = {
  HERO_ACTION: "HERO_ACTION",
  HERO_ACTION_PERCENT: "HERO_ACTION_PERCENT",
  HERO_ENEMY_IS_BOSS: "HERO_ENEMY_IS_BOSS",
  HERO_HEALTH_PERCENT: "HERO_HEALTH_PERCENT",
  HERO_ENERGY_CURRENT: "HERO_ENERGY_CURRENT",
  HERO_ENERGY_BONUS: "HERO_ENERGY_BONUS",
  HERO_TOTAL_ENERGY: "HERO_TOTAL_ENERGY"


};

const map = {};
map[PARAM.HERO_ACTION] = "action.type";
map[PARAM.HERO_ACTION_PERCENT] = "action.percents";
map[PARAM.HERO_ENEMY_IS_BOSS] = "action.is_boss";
map[PARAM.HERO_HEALTH_PERCENT] = "base.health_percent";
map[PARAM.HERO_ENERGY_CURRENT] = "energy.value";
map[PARAM.HERO_ENERGY_BONUS] = "energy.bonus";
map[PARAM.HERO_TOTAL_ENERGY] = "energy.total";


const REL = {
  GREATER: "GREATER",
  LOWER: "LOWER",
  IS: "IS",
  YES: "YES",
  NO: "NO"
};


class Rule
{
  /**
   *
   * @param param
   * @param rel
   * @param value
   */
  constructor(param, rel, value) {
    this.param = param;
    this.rel = rel;
    this.value = value;
    this._cache = null;
  }

  toString() {
    if (this._cache == null) {
      var vars = map[this.param].split(".");
      var str = [
        ["hero['", vars[0], "']['", vars[1], "']"].join('')
      ];
      switch (this.rel) {
        case REL.GREATER:
          this.value = 1 * this.value;
          str.push(">");
          break;
        case REL.LOWER:
          this.value = 1 * this.value;
          str.push("<");
          break;
        case REL.IS:
          str.push("==");
          break;
        case REL.YES:
          str.push("== true");
          break;
        case REL.NO:
          str.push("== false");
          break;
      }
      if (typeof this.value !== 'undefined') {
        str.push(this.value);
      }
      this._cache = str.join(' ');
    }
    return this._cache;
  }

  toFunction() {
    return new Function('hero', ["return ",this.toString(),";"].join(''));
  }
}


module.exports = {
  Rule: Rule,
  PARAM: PARAM,
  REL: REL
};