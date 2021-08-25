const { Memo, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper } = require('stellar-account-helper')

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return account.operations({limit: 200})
                .then(({records}) => records)
                .then(operations => operations.filter(o => o.type === 'bump_sequence' && o.bump_to === '110101115104111'))
                .then(bumpSequenceOperations => new Promise((resolve, reject) => bumpSequenceOperations.length > 0
                    ? resolve() : reject('Expected operation not found')
                ));
        });
}
const challenge = async (challengeKeypair, challengeRiddle) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge1: Found correct operation -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge1: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair, challengeRiddle));
            }
            console.log('Challenge1: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addMemo(Memo.text('hanseartic/stellar-quest'))
                    .addOperation(Operation.bumpSequence({
                        bumpTo: challengeRiddle,
                        source: account.id,
                    }))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                })
        })
        .then(() => {console.log('Challenge1: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    const readVar = require('../readVar');
    challengeKeypair('Quest Keypair', 'SQ0301_SECRET_KEY')
        .then(keypair => readVar('Please enter the desired sequence number: ', 'SQ0301_RIDDLE')
            .then(riddle => ({keypair, riddle})))
        .then(({keypair, riddle}) => challenge(keypair, riddle))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
