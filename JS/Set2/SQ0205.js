const { Asset, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return account.operations({limit: 200}).then(({records}) => records)
        })
        .then(records => records.filter(r => r.type === 'claim_claimable_balance'))
        .then(records => records.length >= 1 ? Promise.resolve() : Promise.reject('No claimable balances claimed'));
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge5: Found claimed claimable balance -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge5: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge5: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => server.claimableBalances()
                        .claimant(account.id)
                        .asset(Asset.native())
                        .call()
                        .then(({records}) => ({account, records}))
                )
                .then(({account, records}) => {
                    return Promise.all(records.map(async record => {
                        const claimTransaction = new TransactionBuilder(account, transactionOptions)
                            .addOperation(Operation.claimClaimableBalance({balanceId: record.id}))
                            .setTimeout(0)
                            .build();
                        claimTransaction.sign(challengeKeypair);
                        await server.submitTransaction(claimTransaction).catch(e => console.warn(e.response.data));
                    }));
                })
        })
        .then(() => {console.log('Challenge5: done!')})
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