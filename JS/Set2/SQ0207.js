const { Asset, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return account.operations({limit: 100}).then(({records: operations}) => operations)
        })
        .then(operations => {
            const sponsoredAccountId = operations.find(o => o.type === 'begin_sponsoring_future_reserves').sponsored_id;
            return !!operations.find(o => o.type === 'revoke_sponsorship' && o.account_id === sponsoredAccountId)
                ? Promise.resolve()
                : Promise.reject('No end sponsorship found.');
        });
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge7: Found ending of sponsorship -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge7: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge7: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => account.operations({limit: 100})
                        .then(({records: operations}) => ({account, operations}))
                )
                .then(({account, operations}) => ({account, operation: operations.find(o => o.type === 'begin_sponsoring_future_reserves')}))
                .then(({account, operation}) => new TransactionBuilder(account, transactionOptions)
                    .addOperation(Operation.payment({
                        asset: Asset.native(),
                        amount: '10',
                        destination: operation.sponsored_id,
                    }))
                    .addOperation(Operation.revokeAccountSponsorship({account: operation.sponsored_id}))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                });
        })
        .then(() => {console.log('Challenge7: done!')})
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