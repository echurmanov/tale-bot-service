"use strict";

const Promise = require ('bluebird');
const http = require ('http');

var PromiseRequest = Promise.method(function(options, data) {

  return new Promise(function(resolve, reject) {
    console.log(options);
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
      console.log("Request Error", error);
      reject(error);
    });
    console.log(data);
    if (typeof data != 'undefined') {
      console.log("Write data");
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


module.exports = {
  PromiseRequest: PromiseRequest,
  TokenGenerator: TokenGenerator
};