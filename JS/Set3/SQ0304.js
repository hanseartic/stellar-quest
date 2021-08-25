const { Memo, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper, SupportedNetworks } = require('stellar-account-helper');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);

            return AccountHelper
                .getCreatedCursor(account.id, SupportedNetworks.TESTNET.network)
                .catch(console.warn)
                .then(latestCreateAccountOperationCursor => server.transactions()
                    .forAccount(account.id).order('asc').limit(200).cursor(latestCreateAccountOperationCursor)
                    .call()
                )
                .then(({records}) => records.find(r => r.signatures.length === 0))
                .then(hasUnsignedTransaction => new Promise((resolve, reject) => {
                    if (hasUnsignedTransaction) {
                        resolve();
                    } else {
                        reject('No pre-signed transaction found.')
                    }
                }));
        });
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge4: Found correct operation -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge4: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair));
            }
            console.log('Challenge4: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => {
                    // the pre-Signed transaction needs a higher sequence than the transaction that
                    // is used to add the pre-signed transaction to the account
                    account.incrementSequenceNumber();
                    return new TransactionBuilder(account, transactionOptions)
                        .addMemo(Memo.text('hanseartic/stellar-quest'))
                        .addOperation(Operation.manageData({
                            name: 'I am from a pre-signed TX',
                            value: 'My transaction has no signatures',
                        }))
                        .setTimeout(0)
                        .build();
                })
                // load the account again with the original sequence-number
                .then(preSignedTx => server.loadAccount(challengeKeypair.publicKey())
                        .then(accountWithOriginalSequence => ({accountWithOriginalSequence, preSignedTx}))
                )
                .then(({accountWithOriginalSequence, preSignedTx}) => {
                    const transactionThatAddsPreSignedTX = new TransactionBuilder(accountWithOriginalSequence, transactionOptions)
                        .addMemo(Memo.text('hanseartic/stellar-quest'))
                        .addOperation(Operation.setOptions({
                            signer: {
                                preAuthTx: preSignedTx.hash(),
                                weight: '1',
                            }
                        }))
                        .setTimeout(0)
                        .build();
                    transactionThatAddsPreSignedTX.sign(challengeKeypair);

                    // add the pre-signed TX to the account
                    return server.submitTransaction(transactionThatAddsPreSignedTX).then(() => preSignedTx);
                })
                // now submit the pre-signed transaction.
                // note that this transaction was never signed itself
                .then(preSignedTx => server.submitTransaction(preSignedTx))
        })
        .then(() => {console.log('Challenge4: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()), err => { console.log(err) })
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ0301_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
