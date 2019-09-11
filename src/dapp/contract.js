import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json'
import Config from './config.json'
import Web3 from 'web3'

export default class Contract {
  constructor(network, callback) {
    let config = Config[network]
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url))
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress)
    this.initialize(callback)
    this.owner = null
    this.airlines = []
    this.passengers = []
  }

  initialize (callback) {
    this.web3.eth.getAccounts(async (error, accts) => {
      this.owner = accts[0]

      let counter = 1

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++])
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter++])
      }
      console.log(this.airlines)
      console.log(this.passengers)
      await this.flightSuretyApp.events.allEvents({ fromBlock: 'latest' })
        .on('data', console.log)
        .on('changed', console.log)
        .on('error', console.log);

      callback()
    })
  }

  isOperational (callback) {
    let self = this
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback)
  }
  async registerFlight (flight, timestamp) {
    let self = this
    let payload = {
      airline: self.airlines[0],
      flight: flight,
      timestamp: timestamp
    }
    console.log(payload.airline)
    const result = await self.flightSuretyApp.methods
      .registerFlight(payload.flight, payload.timestamp, payload.airline)
      .send({ from: self.owner, gas: 6721975, gasPrice: 100000000000 })
    return result
  }

  fetchFlightStatus (flight, callback) {
    let self = this
    let payload = {
      airline: self.airlines[0],
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000)
    }
    self.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: self.owner }, (error, result) => {
        callback(error, payload)
      })
  }
  async authorizeContract (address) {
    let self = this
    let payload = {
      address: address
    }
    let result = await self.flightSuretyApp.methods
      .authorizeCaller(payload.address)
      .send({ from: self.owner })
    return result
  }
  async getFlights () {
    let self = this
    let result = await self.flightSuretyApp.methods
      .getFlights()
      .call({ from: self.owner })
    return result
  }
  async buyInsurance (flight, timestamp, value) {
    let self = this
    let payload = {
      airline: self.airlines[0],
      flight: flight,
      timestamp: timestamp
    }
    let result = await self.flightSuretyApp.methods
      .buy(payload.airline, payload.timestamp, payload.flight)
      .send({ from: self.owner, value: value, gas: 6721975, gasPrice: 100000000000 })
    return result
  }
}
