const { Asset, Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return account.operations();
        })
        .then(({records}) => records.find(r => r.type === 'change_trust')?.transaction())
        .then(transaction => transaction?.operations()??Promise.reject('no transaction found'))
        .then(({records: operations}) => {
            return !!operations.find(o => o.type === 'change_trust')
                && !!operations.find(o =>
                    o.type === 'payment'
                    && o.source_account !== publicKey
                    && o.to === publicKey
                    && o.source_account === o.asset_issuer
                )
                ? Promise.resolve()
                : Promise.reject('not all expected operations in a single transaction');
        });
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge2: Custom asset already issued and sent to account -> skipping');
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge2: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge2: Account exists but the expected transaction could not be found. Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => ({challengeAccount: account, issuingKeypair: Keypair.random()}))
                .then(({challengeAccount, issuingKeypair}) => ({
                            transaction: new TransactionBuilder(challengeAccount, transactionOptions)
                                .addOperation(Operation.createAccount(
                                    {
                                        destination: issuingKeypair.publicKey(),
                                        startingBalance: "1.5",
                                    }))
                                .addOperation(Operation.changeTrust({
                                    asset: new Asset('SQ0202', issuingKeypair.publicKey()),
                                }))
                                .addOperation(Operation.payment({
                                    asset: new Asset('SQ0202', issuingKeypair.publicKey()),
                                    destination: challengeKeypair.publicKey(),
                                    source: issuingKeypair.publicKey(),
                                    amount: '1',
                                }))
                                .setTimeout(0)
                                .build(),
                            issuingKeypair})

                )
                .then(({transaction, issuingKeypair}) => {
                    transaction.sign(challengeKeypair, issuingKeypair);
                    console.log("Sending custom asset");
                    return server.submitTransaction(transaction)
                        .then(() => server.loadAccount(issuingKeypair.publicKey()))
                        .then(issuingAccount => ({issuingAccount, issuingKeypair}));
                })
                .then(({issuingAccount, issuingKeypair}) => {
                    console.log("Removing issuing account");
                    // we are removing the issuing account of the custom asset in order to not clutter the ledger with another
                    // orphan account
                    const transaction = new TransactionBuilder(issuingAccount, transactionOptions)
                        .addOperation(Operation.accountMerge({destination: challengeKeypair.publicKey()}))
                        .setTimeout(0)
                        .build();
                    transaction.sign(issuingKeypair);
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
