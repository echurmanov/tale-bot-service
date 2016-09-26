"use strict";

const Promise = require ('bluebird');
const http = require ('http');

var PromiseRequest = Promise.method(function(options, data) {

  return new Promise(function(resolve, reject) {
    var request = http.request(options, function(response) {
      // Bundle the result
      var result = {
        'httpVersion': response.httpVersion,
        'httpStatusCode': response.statusCode,
        'headers': response.headers,
        'body': '',
        'trailers': response.trailers
      };
      response.encoding = null;
      var body = Buffer.from("");
      response.on('data', function(chunk) {
        body = Buffer.concat([body, chunk]);
      });

      response.on('end', function(){
        result.body = body.toString("utf-8");
        resolve(result);
      });
    });

    // Handle errors
    request.on('error', function(error) {
      reject(error);
    });
    if (typeof data != 'undefined') {
      request.write(data);
    }
    request.end();
  });
});

var TokenGenerator = function(){
  var text = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 32; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
};

var ParseCookies = function (cookieSets) {
  var list = {};
  for(var i = 0; i < cookieSets.length; i++) {
    var rawCookie = cookieSets[i].split(';')[0].split('=');
    list[rawCookie[0]] = rawCookie[1];
  }
  return list;
};


module.exports = {
  PromiseRequest: PromiseRequest,
  TokenGenerator: TokenGenerator,
  ParseCookies: ParseCookies
};