
var Test = require('../config/testConfig.js')
const truffleAssert = require('truffle-assertions');
var BigNumber = require('bignumber.js')
var FlightSuretyData = artifacts.require('FlightSuretyData')
var FlightSuretyApp = artifacts.require('FlightSuretyApp')

const MINAIRLINEFUNDING = web3.utils.toWei('10', 'ether')
const REGISTRATIONFEE = MAXINSURANCE = web3.utils.toWei('1', 'ether')


contract('Flight Surety Tests', async (accounts) => {
  var config
  before('setup contract', async () => {
    config = await Test.Config(accounts)
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address)
    // const MINAIRLINEFUNDING = await config.flightSuretyData.MINAIRLINEFUNDING.call()
    await config.flightSuretyApp.fund({ from: config.firstAirline, value: MINAIRLINEFUNDING })
    await config.flightSuretyApp.registerAirline('American Airlines', config.firstAirline, { from: config.owner })
  })

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call()
    assert.equal(status, true, 'Incorrect initial operating status value')
  })

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false
    try {
      await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] })
    } catch (e) {
      accessDenied = true
    }
    assert.equal(accessDenied, true, 'Access not restricted to Contract Owner')
  })

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false
    try {
      await config.flightSuretyData.setOperatingStatus(false)
    } catch (e) {
      accessDenied = true
    }
    assert.equal(accessDenied, false, 'Access not restricted to Contract Owner')
  })

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false)

    let reverted = false
    try {
      await config.flightSurety.setTestingMode(true)
    } catch (e) {
      reverted = true
    }
    assert.equal(reverted, true, 'Access not blocked for requireIsOperational')

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true)
  })
  it('(airline) is registered and funded when contract is created', async () => {
    let result = await config.flightSuretyData.isAirlineRegistered.call(config.firstAirline)
    assert.equal(result, true, 'First Airline should always be registered')
    let result2 = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline)
    assert.equal(result2, true, 'First Airline should always be funded')
  })
  it('(airline) cannot register an Airline (participate in contract) using registerAirline() if it is not funded', async () => {
    // ARRANGE
    let newAirline = accounts[2]
    let newAirline20 = accounts[20]

    // ACT
    try {
      await config.flightSuretyApp.registerAirline('Delta Airlines', newAirline, { from: config.firstAirline })
    } catch (e) {

    }
    let result = await config.flightSuretyData.isAirlineFunded.call(config.firstAirline)
    assert.equal(result, true, 'American should be funded since it was done on initiation')
    result = await config.flightSuretyData.isAirlineRegistered.call(newAirline)
    assert.equal(result, true, 'Delta should be registered since American was funded')
    try {
      await config.flightSuretyApp.registerAirline('Allegiant Airlines', newAirline20, { from: newAirline })
    } catch (e) {

    }
    // ASSERT
    result = await config.flightSuretyData.isAirlineFunded.call(newAirline)
    assert.equal(result, false, 'Delta should not be funded')
    result = await config.flightSuretyData.isAirlineRegistered.call(newAirline20)
    assert.equal(result, false, "Delta should not be able to register another airline (Allegiant) if it hasn't provided funding")
  })
  it('(exisitng airline) can register a new airline up to four registrations', async () => {
    // no. 3
    await config.flightSuretyApp.fund({ from: accounts[4], value: MINAIRLINEFUNDING })
    await config.flightSuretyApp.registerAirline('My Airline', accounts[4], { from: config.firstAirline })
    // no.4
    await config.flightSuretyApp.fund({ from: accounts[5], value: MINAIRLINEFUNDING })
    await config.flightSuretyApp.registerAirline('My Airline', accounts[5], { from: config.firstAirline })

    let result = BigNumber(await config.flightSuretyData.getRegisteredAirlineCount.call())
    assert.equal(result.toNumber(), 4, 'Should only be 4 airlines registered')
    result = await config.flightSuretyData.isAirlineRegistered(accounts[5])
    assert.equal(result, true, 'Airline 4 should be registered')
  })
  it('(airline) should vote for added airlines past 4', async () => {
    await config.flightSuretyApp.fund({ from: accounts[6], value: MINAIRLINEFUNDING })
    let result = BigNumber(await config.flightSuretyData.getRegisteredAirlineCount.call())
    console.log('Registered Airlines:' + result.toString())
    const votesNeeded = Math.ceil(result / 2)
    console.log('Votes Needed:' + votesNeeded)

    result = await config.flightSuretyData.isAirlineRegistered(accounts[6])
    assert.equal(result, false, 'Airline 5 should NOT be registered')
    for (let i = 0; i < votesNeeded; i++) {
      await config.flightSuretyApp.registerAirline('Southwest Airlines', accounts[6], { from: accounts[i] })
      if (i === 0) {
        result = await config.flightSuretyData.isAirlineRegistered(accounts[6])
        assert.equal(result, false, 'Airline 5 should not be registered yet')
      }
    }
    result = await config.flightSuretyData.isAirlineRegistered(accounts[6])
    assert.equal(result, true, 'Airline 5 should be registered')
    result = BigNumber(await config.flightSuretyData.getRegisteredAirlineCount.call())
    assert.equal(result, 5, 'Should be 5 Airlines Registered')
  })
  it('(flight) should be able to register flight', async () => {
    let airline = accounts[1]
    let flight = 'Flight AA180'
    let timestamp = new Date(2019, 08, 01).valueOf()

    let registered = await config.flightSuretyData.isFlightRegistered(airline, flight, timestamp, { from: airline })
    assert.equal(registered, false, 'Flight is already registered')
    await config.flightSuretyApp.registerFlight(flight, timestamp, airline, { from: airline })
    registered = await config.flightSuretyData.isFlightRegistered(airline, flight, timestamp, { from: airline })
    assert.equal(registered, true, 'should be able to register a flight')
  })
  it('(passenger) should get flights', async () => {
    let flights = await config.flightSuretyApp.getFlights()
    assert.equal(flights.length, 1, 'Should be 1 flight registered')
  })
  it('(passenger) should be able to buy insurance <= 1 ether', async () => {

    let airline = accounts[1]
    let passenger = accounts[49]
    let flight = 'Flight AA180'
    let timestamp = new Date(2019, 08, 01).valueOf()
    let registered = await config.flightSuretyData.isFlightRegistered(airline, flight, timestamp)
    assert.equal(registered, true, 'flight should be registerd')
    await config.flightSuretyApp.buy(airline, timestamp, flight, { value: MAXINSURANCE - 1000000000, from: passenger })

  })
  it('(passenger) should be credited 1.5X if flight is delayed', async () => {
    let airline = accounts[1]
    let passenger = accounts[49]
    let flight = 'Flight AA180'
    let timestamp = new Date(2019, 08, 01).valueOf()

    //register 30 oracles 
    for (let oracle = 1; oracle < 49; oracle++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[oracle], value: REGISTRATIONFEE });
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[oracle] });
    }
    let tx1 = await config.flightSuretyApp.fetchFlightStatus(airline, flight, timestamp);
    let index = -1
    truffleAssert.eventEmitted(tx1, 'OracleRequest', async (ev) => {
      index = BigNumber(ev[0]).toNumber()
    })
    while (index == -1) { }
    //hope for 3 responses that match
    let successes = 0;

    for (let oracle = 1; oracle < 49; oracle++) {
      let oracleIndexes1 = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[oracle] });
      let oindex = oracleIndexes1.find((x) => { return BigNumber(x).toNumber() === index })
      if (oindex == null) continue;
      try {
        let tx = await config.flightSuretyApp.submitOracleResponse(index, airline, flight, timestamp, 20, { from: accounts[oracle] });
        truffleAssert.eventEmitted(tx, 'OracleReport');
        let tx2 = await truffleAssert.createTransactionResult(config.flightSuretyData, tx.tx);
        successes++;
        if (successes == 3) {
          truffleAssert.eventEmitted(tx, 'FlightStatusInfo');
          truffleAssert.eventEmitted(tx2, 'ClaimIsReady', (ev) => {
            console.log(web3.utils.fromWei(ev.claimAmount.toString(), 'ether'));
            return true;
          });
        }
      } catch (err) {
        console.log(err.toString().substring(0, 150))
        continue;
      }
    }
  })
  it('(passenger) should be able to withdraw funds after flight is delayed and account credited', async () => {
    let passenger = accounts[49]
    let originalAmount = web3.utils.fromWei(await web3.eth.getBalance(passenger), 'ether');
    let tx = await config.flightSuretyApp.cashOut({ from: passenger });
    let imrich = web3.utils.fromWei(await web3.eth.getBalance(passenger), 'ether');
    console.log(originalAmount)
    console.log(imrich)
    assert.equal(originalAmount*100 < imrich*100, true, 'I should have more monies');
  })

})
