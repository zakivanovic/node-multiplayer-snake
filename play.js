// create http request client to consume the QPX API
const request = require('request');

// QPX REST API URL (I censored my api key)
const url = 'http://localhost:3000/capture';

let max = 5;

// fire request
function capture() {

  const reqBody = {
      id: '2hNf_uEP4fGb_hhsAAAE',
      block: Math.floor(Math.random() * Math.floor(max)) + ':' + Math.floor(Math.random() * Math.floor(max)),
  };

  console.log(reqBody.block);

  request(
    {
        uri : url,
        method: 'POST',
        json: reqBody,
    },
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log(body);
      } else {
        console.log('error: ' + error);
        console.log('response: ' + response);
      }
    }
  );
}

setInterval(capture, 50);

setInterval(() => { ++max; }, 5000);
