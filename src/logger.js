"use strict";

class Logger {
  constructor (dbPool) {
    this.dbPool = dbPool;
  }

  logApiRequest(tokenId, accountId, requestUrl, requestOptions, requestPostData, requestTime, responseBody, responseStatus, responseTime) {
    this.dbPool.getConnectionSync()
      .then((conn) => {
        var data = {
          token_id: tokenId,
          account_id: accountId,
          request_url: requestUrl,
          request_time: requestTime,
          request_options: requestOptions,
          request: requestPostData,
          response_status: responseStatus,
          response_body: responseBody,
          response_time: responseTime
        };
        conn.query("INSERT INTO `api_request_log` SET ?", data, (err) => {
          conn.release();
          if (err) {
            console.log("DB ERROR", err.message);
          }
        });
      })
      .catch((error) => {
        console.log("DB ERROR", error.message);
      });
  }

  logAction(tokenId, accountId, actionDate, action, actionParams, actionResult) {
    this.dbPool.getConnectionSync()
      .then((conn) => {
        var data = {
          token_id: tokenId,
          account_id: accountId,
          action_date: actionDate,
          action: action,
          action_params: (typeof actionParams != "string")?JSON.stringify(actionParams):actionParams,
          action_result: (typeof actionResult != "string")?JSON.stringify(actionResult):actionResult
        };
        conn.query("INSERT INTO `bot_action_log` SET ?", data, (err) => {
          conn.release();
          if (err) {
            console.log("DB ERROR", err.message);
          }
        });
      })
      .catch((error) => {
        console.log("DB ERROR", error.message);
      });
  }
}

module.exports = Logger;
