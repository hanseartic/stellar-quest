const crypto = require('crypto');
const { Keypair, Memo, Operation, TransactionBuilder } = require('stellar-sdk');
const { filter, find } = require('lodash');
const BigNumber = require('bignumber.js');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => account.operations())
        .then(({records}) => !!find(
            filter(records, (record) => record.type === 'create_account'),
            (createAccountRecord) => new BigNumber(createAccountRecord.starting_balance).eq(5000))
            ? Promise.resolve(true)
            : Promise.reject('Could not find account being created with correct starting balance.')
        );
};
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge1: Account is already created with correct funding -> skipping');
        })
        .catch(reason => {
            if (! reason instanceof Error) {
                console.log('Challenge1: Account exists but was not funded with the correct amount. You may want to reset it.');
                return;
            }
            console.log('Challenge1: Account does not exist, yet. Creating it now.');
            const funderKeypair = Keypair.random();
            return server.friendbot(funderKeypair.publicKey()).call()
                .then(() => server.loadAccount(funderKeypair.publicKey()))
                .then(funderAccount => new TransactionBuilder(funderAccount, transactionOptions)
                    .addOperation(Operation.createAccount({
                        destination: challengeKeypair.publicKey(),
                        startingBalance: "5000",
                    }))
                    .addOperation(Operation.accountMerge({destination: challengeKeypair.publicKey()}))
                    .addMemo(Memo.hash(crypto.createHash("sha256").update("Stellar Quest Series 2").digest("hex")))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(funderKeypair);
                    console.log("Challenge1: Submitting transaction to create a new account.")
                    return server.submitTransaction(transaction);
                });
        })
        .then(() => {console.log('Challenge1: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
};
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
