const { Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return account.operations({limit: 100}).then(({records}) => records)
        })
        .then(operations => !!operations.find(o => o.type === 'begin_sponsoring_future_reserves'))
        .then(verified => verified ? Promise.resolve() : Promise.reject('No sponsored account created by this account.'));
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge6: Found sponsored account -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge6: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge6: Running challenge!');
            const sponsoredAccountKeypair = Keypair.random();
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addOperation(Operation.beginSponsoringFutureReserves({sponsoredId: sponsoredAccountKeypair.publicKey()}))
                    .addOperation(Operation.createAccount({destination: sponsoredAccountKeypair.publicKey(), startingBalance: '0'}))
                    // this way transactions on the sponsored account can signed with the key of the creating/sponsoring account
                    // not part of the quest but helps keeping things clean
                    .addOperation(Operation.setOptions({
                        signer: {ed25519PublicKey: account.id, weight: 1},
                        source: sponsoredAccountKeypair.publicKey()
                    }))
                    // this is mandatory when sponsoring future reserves:
                    // https://developers.stellar.org/docs/start/list-of-operations/#end-sponsoring-future-reserves
                    .addOperation(Operation.endSponsoringFutureReserves({source: sponsoredAccountKeypair.publicKey()}))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair, sponsoredAccountKeypair);
                    return server.submitTransaction(transaction);
                })
        })
        .then(() => {console.log('Challenge6: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ02_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}