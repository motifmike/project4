import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';

import Config from './config.json';
import "regenerator-runtime/runtime";

import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let statusCodes = [0, 10, 20, 30, 40, 50]
let accounts
web3.eth.getAccounts(async (err, acc) => {
  accounts = acc
  const fee = 1000000000000000000 //1 ether
  for (let i = 0; i < 100; i++) {
    await flightSuretyApp.methods.registerOracle().send({ value: fee, from: accounts[i], gas: 6721975 });
  }

  await flightSuretyApp.events.FlightStatusInfo({
    fromBlock: 0
  }, async (error, event) => {
    if (error) console.log(error);

  });

  await flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, async function (error, event) {
    if (error) console.log(error)
    try {
      for (let i = 0; i < 100; i++) {
        let indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: accounts[i] });
        if (indexes.indexOf(event.returnValues.index) >= 0) {
          var randomValue = statusCodes[Math.floor(statusCodes.length * Math.random())];
          console.log(`Oracle ${i} registered with address ${accounts[i]} submitting response of ${randomValue}`)

          await flightSuretyApp
            .methods
            .submitOracleResponse(event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp, randomValue)
            .send({ from: accounts[i], gas: 6721975 });
        }
      }
    } catch (err) {
      console.log(err);
    }
  });
  await flightSuretyData.events.ClaimIsReady({
    fromBlock: 0
  }, async (error, event) => {
    if (error) console.log(error);
    console.log(`Insurance Claim of ${event.returnValues.claimAmount} for ${event.returnValues.passenger} is available.`);
  });
})





const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;


