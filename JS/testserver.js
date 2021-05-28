const { BASE_FEE, Networks, Server } = require('stellar-sdk')

module.exports = {
    server: new Server('https://horizon-testnet.stellar.org'),
    transactionOptions: {fee: BASE_FEE, networkPassphrase: Networks.TESTNET,},
};
