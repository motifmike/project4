
import DOM from './dom'
import Contract from './contract'
import './flightsurety.css';

(async () => {
  let contract = new Contract('localhost', async () => {
    contract.initialize(async (err, initResult) => {
      // Read transaction
      contract.isOperational((error, result) => {
        console.log(error, result)
        display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }])
      })

      try {
        var flights = await contract.getFlights()
        console.log(flights)
        flights.forEach((flight, index) => {
          DOM.elid('flights-select').appendChild(DOM.option(flight))
        })
      } catch (e) {
        console.log(e)
      }

      // 1) AUTHORIZE AN AIRLINE
      // DOM.elid('auth').addEventListener('click', async () => {
      //   let address = DOM.elid('auth-addr').value

      //   let result
      //   let error = null
      //   try {
      //     result = await contract.authorizeContract(address)
      //   } catch (e) {
      //     error = e
      //   }
      //   display('Auth', 'AuthorizeContract', [{ label: 'Auth', error: error, value: JSON.stringify(result) }])
      // })
      // User-submitted transaction
      DOM.elid('submit-oracle').addEventListener('click', () => {
        let flight = DOM.elid('flight-number').value
        // Write transaction
        contract.fetchFlightStatus(flight, (error, result) => {
          console.log(error)
          display('Oracles', 'Trigger oracles', [{ label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp }])
        })
      })
      //BUY INSURANCE
      DOM.elid('submit-insurance').addEventListener('click', async () => {
        let amount = DOM.elid('insurance-value').value
        let flight = DOM.elid('flight-number').value
        let flightTimestamp = DOM.elid('flight-timestamp').value

        let result
        let error = null
        try {
          result = await contract.buyInsurance(flight, flightTimestamp, amount)
        } catch (e) {
          console.log(e)
          error = e
        }
        display('Insurance', 'Buy Insurance', [{ label: 'Insurance', error: error, value: JSON.stringify(result) }]);

      })
      // REGISTER FLIGHT
      DOM.elid('register-flight').addEventListener('click', async () => {
        let flight = DOM.elid('flight-number').value
        let flightTimestamp = DOM.elid('flight-timestamp').value
        let error = null
        let result = null
        // Write transaction
        try {
          result = await contract.registerFlight(flight, flightTimestamp)
        } catch (err) {
          error = err
        }

        display('Flight Registration', 'Flight Registration', [{ label: 'Flight:', error: error, value: JSON.stringify(result) }])
        DOM.elid('flights-list').appendChild(DOM.p(flight + " @ " + flightTimestamp))

      })
    })
  })
})()

function display (title, description, results) {
  let displayDiv = DOM.elid('display-wrapper')
  let section = DOM.section()
  section.appendChild(DOM.h2(title))
  section.appendChild(DOM.h5(description))
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: 'row' }))
    row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label))
    row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)))
    section.appendChild(row)
  })
  displayDiv.append(section)
}
