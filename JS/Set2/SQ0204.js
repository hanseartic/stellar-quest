const { Asset, Claimant, Operation, TransactionBuilder } = require('stellar-sdk');
const BigNumber = require('bignumber.js');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return server.claimableBalances()
                .claimant(account.id)
                .asset(Asset.native())
                .call();
        })
        .then(({records}) => records.flatMap(b => b.claimants.filter(c => c.destination === publicKey)).filter(c => c.predicate.not !== undefined))
        .then(claimants => claimants.map(c => c.predicate.not).map(p => new Date(p.abs_before)).filter(d => !Number.isNaN(new Date(d).getTime())))
        .then(dates => dates.map(date => date - new Date("2020-01-01T00:00:00.000Z")).filter(diff => diff > 0))
        .then(diffs => diffs.length > 0 ? Promise.resolve() : Promise.reject('no matching claimable balance found'));
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge4: Found claimable balance with correct predicate -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge4: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge4: Running challenge!');

            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addOperation(Operation.createClaimableBalance({
                        asset: Asset.native(),
                        amount: '100',
                        claimants: [
                            new Claimant(
                                account.id,
                                // the balance needs to be claimable only after a certain amount of time
                                // the sdk uses seconds as unit
                                Claimant.predicateNot(Claimant.predicateBeforeRelativeTime(new BigNumber(1)
                                    // in actual quest situation sth. like the following would be required
                                    // but in practice mode any time is fine because also SQ0205 is in the past already
                                    // .times(new BigNumber(60)) // a minute
                                    // .times(new BigNumber(60)) // an hour
                                    // .times(new BigNumber(24)) // a day
                                    // .times(new BigNumber(7))  // a week
                                    .toString())
                                )
                            ),
                        ],
                    }))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                })
        })
        .then(() => {console.log('Challenge4: done!')})
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