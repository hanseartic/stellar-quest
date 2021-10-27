const { Operation, Networks, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper } = require('stellar-account-helper');
const fetch = require('node-fetch');
const chunkData = require('../chunk-data');

const verifyChallenge = async (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);

            return new Promise((resolve, reject) => reject('Currently no verification for this challenge.'));
        });
};

const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge7: Found token -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge7: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair));
            }
            console.log('Challenge7: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => {
                    const authUrl = 'https://testanchor.stellar.org/auth';
                    return fetch(`${authUrl}?account=${account.id}`)
                        .then(res => res.json())
                        .then(({transaction}) => TransactionBuilder.fromXDR(transaction, Networks.TESTNET))
                        .then(tx => {
                            tx.sign(challengeKeypair);
                            return {transaction: tx.toXDR()};
                        })
                        .then(txObject => fetch(authUrl, {
                            method: 'post',
                            body: JSON.stringify(txObject),
                            headers: { 'Content-Type': 'application/json' },
                        }))
                        .then(res => res.json())
                        .then(jwt => chunkData(jwt.token, 2, 64))
                        .then(chunks => {
                            const transactionBuilder = new TransactionBuilder(account, transactionOptions)
                                .setTimeout(0);
                            chunks.forEach(chunk =>
                                transactionBuilder.addOperation(Operation.manageData(chunk))
                            );
                            return transactionBuilder.build();
                        });
                })
                .then(tx => {
                    tx.sign(challengeKeypair);
                    return server.submitTransaction(tx);
                })
                .then(() => {
                    console.log('Challenge7: done!')
                })
                .then(
                    () => server.loadAccount(challengeKeypair.publicKey()),
                    err => { console.log(err); }
                );
        });
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ0307_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
