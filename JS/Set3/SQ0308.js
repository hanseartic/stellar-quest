const { Asset, Keypair, Networks, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = async (publicKey) => {
    return false;
};

const challenge = async (challengeKeypair) => {
    const got = require('got');
    const transferServer = 'https://testanchor.stellar.org/sep6';
    const authUrl = 'https://testanchor.stellar.org/auth';
    const kycUrl = 'https://testanchor.stellar.org/kyc';

    await server.friendbot(challengeKeypair.publicKey()).call();
    return await server.loadAccount(challengeKeypair.publicKey())
        .then(account => {
            const transaction = new TransactionBuilder(account, transactionOptions)
                .addOperation(Operation.changeTrust({
                    asset: new Asset('MULT', 'GDLD3SOLYJTBEAK5IU4LDS44UMBND262IXPJB3LDHXOZ3S2QQRD5FSMM'),
                }))
                .setTimeout(0)
                .build();
            transaction.sign(challengeKeypair);
            return server.submitTransaction(transaction).then(() => account.account_id);
        })
        .then(accountId => got(`${authUrl}?account=${accountId}`).json())
        .then(({transaction}) => {
            const challengeTransaction = TransactionBuilder
                .fromXDR(transaction, Networks.TESTNET);

            challengeTransaction.sign(challengeKeypair);
            return got(`${authUrl}`, {
                method: 'POST',
                json: {transaction: challengeTransaction.toXDR()},
            }).json();
        })
        .then(({token}) => {
            console.log(token);
            const authHeader = `Bearer ${token}`;
            const queryParams = {
                asset_code: 'MULT',
                account: challengeKeypair.publicKey(),
                type: 'bank_account',
            };
            return got(`${kycUrl}/customer`, {
                    method: 'PUT',
                    headers: {authorization: authHeader, contentType: 'application/json'},
                    json: {account: challengeKeypair.publicKey(), first_name: 'jon', last_name: 'doe', email_address: 'me@you.com', bank_account_number: '98765432', bank_number: 'my bank'},
                }).json()
                .then(json => {
                    console.log(json);
                    return got(`${kycUrl}/customer`, {searchParams: {account: challengeKeypair.publicKey()}, headers: {authorization: authHeader}}).json();
                })
                .then(json => {
                    console.log(json);
                    return got(`${transferServer}/deposit`, {searchParams: queryParams, headers: {authorization: authHeader}})
                        .json();
                })
                .catch(err => err)
        })
        .then(json => console.log(json))
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
};

module.exports = { challenge: challenge, verify: verifyChallenge };
challenge(Keypair.random()).then(account => console.log(account.account_id));
