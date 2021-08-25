const { Memo, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper } = require('stellar-account-helper')

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return server.transactions().forAccount(account.id).order('desc').limit(200).call()
                .then(({records}) => Promise.all(records.map(async record =>
                    // a transaction can have 100 ops max.
                    await record.operations({limit: 101}).then(({records}) => records.length)
                )))
                .then(operationsInTransactionCount => !!operationsInTransactionCount.find(count => count >= 100))
                .then(has100OpTx => new Promise((resolve, reject) => has100OpTx
                    ? resolve() : reject('No matching transaction found')
                ));
        });
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge2: Found transaction with 100 operations -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge2: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair));
            }
            console.log('Challenge2: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => {
                    const transactionBuilder = new TransactionBuilder(account, transactionOptions)
                        .addMemo(Memo.text('hanseartic/stellar-quest'));
                    for(let i = 0; i < 100; i++) {
                        transactionBuilder.addOperation(Operation.manageData({
                            name: 'round ' + i,
                            value: 'fight',
                        }));
                    }
                    return transactionBuilder.setTimeout(0).build();
                })
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                })
        })
        .then(() => {console.log('Challenge2: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ0302_SECRET_KEY')
        .then(challenge)
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
