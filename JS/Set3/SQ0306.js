const { Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper, SupportedNetworks } = require('stellar-account-helper');
const fetch = require('node-fetch');
const chunkData = require('../chunk-data');

const verifyChallenge = async (publicKey, riddle) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return SupportedNetworks.LIVENET.getServer().loadAccount(riddle)
                .then(riddleAccount => riddleAccount.data_attr)
                .then(riddleData => ({expected: JSON.stringify(riddleData), actual: JSON.stringify(account.data_attr)}))
                .then(({expected, actual}) => expected === actual)
                .then(accountHasImage => new Promise((resolve, reject) => {
                    if (accountHasImage) { resolve(); }
                    else { reject('the data found in the account was not correct'); }
                }));
        });
};

const challenge = async (challengeKeypair, riddle) => {
    return verifyChallenge(challengeKeypair.publicKey(), riddle)
        .then(() => {
            console.log('Challenge6: Found the encoded image -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge6: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair, riddle));
            }
            console.log('Challenge6: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => {
                    // add time as query param to avoid caching
                    return fetch(`https://api.stellar.quest/badge/${riddle}?network=public&v=1&ts=${Date.now()}`)
                        .then(res => res.buffer())
                        .then(buffer => buffer.toString('base64'))
                        .then(base64 => chunkData(base64, 2, 64))
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
                    console.log('Challenge6: done!')
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
    const readVar = require('../readVar');
    challengeKeypair('Quest Keypair', 'SQ0306_SECRET_KEY')
        .then(keypair => readVar('Please enter the account holding the image: ', 'SQ0306_RIDDLE')
            .then(riddle => ({keypair, riddle}))
        )
        .then(({keypair, riddle}) => challenge(keypair, riddle))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
