var HDWalletProvider = require('@truffle/hdwallet-provider')
const Web3 = require('Web3')
var mnemonic = 'parent bachelor shy vacant crater clean avocado author much leaf circle fever'

module.exports = {
  networks: {
    development: {
      // provider: function () {
      //   return new HDWalletProvider(mnemonic, 'http://127.0.0.1:7545/', 0, 100)
      // },
      // provider: function () {
      //   return new Web3.providers.WebsocketProvider("ws://localhost:7545");
      // },
      host: '127.0.0.1',
      port: 7545,
      websockets: true,
      network_id: '*',
      gas: 99999999,
      gasPrice: 20000000000
    }
  },
  compilers: {
    solc: {
      version: '^0.5.11'
    }
  }
}
