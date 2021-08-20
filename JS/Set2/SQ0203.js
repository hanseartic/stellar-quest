const { Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return server.transactions().forAccount(account.id).call()
                .then(({records: transactions}) => !!transactions.find(t => t.fee_account !== t.source_account))
                .then(result => result ? Promise.resolve() : Promise.reject('No channeled transaction found'));
        });
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge3: Found fee bump transaction -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge3: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge3: Account exists but the expected transaction could not be found. Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addOperation(Operation.manageData(
                        {
                            name: 'SQ0203',
                            value: 'fees have been sponsored',
                        }))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return {innerTransaction: transaction, channelKeypair: Keypair.random()};
                })
                .then(data => server.friendbot(data.channelKeypair.publicKey()).call().then(() => data))
                .then(({innerTransaction, channelKeypair}) => {
                        const feeBumpTransaction = new TransactionBuilder
                            .buildFeeBumpTransaction(
                                channelKeypair,
                                transactionOptions.fee,
                                innerTransaction,
                                transactionOptions.networkPassphrase);
                        feeBumpTransaction.sign(channelKeypair);
                        return server.submitTransaction(feeBumpTransaction)
                            .then(() => server.loadAccount(channelKeypair.publicKey()))
                            .then(channelAccount => ({
                                channelKeypair,
                                channelAccount
                            }));
                    }
                )
                .then(({channelKeypair, channelAccount}) => {
                    console.log('Removing channel account')
                    const cleanUpTransaction = new TransactionBuilder(channelAccount, transactionOptions)
                        .addOperation(Operation.accountMerge({destination: challengeKeypair.publicKey()}))
                        .setTimeout(0)
                        .build();
                    cleanUpTransaction.sign(channelKeypair);
                    return server.submitTransaction(cleanUpTransaction);
                })
        })
        .then(() => {console.log('Challenge3: done!')})
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