const { BASE_FEE, Networks, Server } = require('stellar-sdk');
const BigNumber = require('bignumber.js');

module.exports = {
    server: new Server('https://horizon-testnet.stellar.org'),
    transactionOptions: {fee: new BigNumber(BASE_FEE).times(1000).toString(), networkPassphrase: Networks.TESTNET,},
};
