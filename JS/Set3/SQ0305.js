const { Asset, AuthClawbackEnabledFlag, AuthRevocableFlag, Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper, SupportedNetworks } = require('stellar-account-helper');

const verifyChallenge = async (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return AccountHelper
                .getCreatedCursor(account.id, SupportedNetworks.TESTNET.network)
                .catch(console.warn)
                .then(cursor => account.operations({cursor: cursor, limit: 200, order: 'asc'}))
                .then(({records}) => records.find(r => r.type === 'clawback' && r.asset_issuer === account.id))
                .then(clawbackFound => new Promise((resolve, reject) => {
                    if (clawbackFound) { resolve(); }
                    else { reject('no clawback operation found on account')}
                }));
        });
};

const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge5: Found correct operation -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge5: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair));
            }
            console.log('Challenge5: Running challenge!');
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => {
                    const targetKeypair = Keypair.random();
                    const myAsset = new Asset('SQ0305Claw', account.id);
                    const clawbackTransaction = new TransactionBuilder(account, transactionOptions)
                        .addOperation(Operation.setOptions({
                            setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
                        }))
                        .addOperation(Operation.beginSponsoringFutureReserves({
                            sponsoredId: targetKeypair.publicKey(),
                        }))
                        .addOperation(Operation.createAccount({
                            destination: targetKeypair.publicKey(),
                            startingBalance: '0',
                        }))
                        .addOperation(Operation.changeTrust({
                            asset: myAsset,
                            limit: '100',
                            source: targetKeypair.publicKey(),
                        }))
                        // this is not necessary for this challenge but allows to delete the account
                        // later without the need to know the secret
                        .addOperation(Operation.setOptions({
                            signer: {
                                ed25519PublicKey: account.id,
                                weight: '1',
                            },
                            source: targetKeypair.publicKey(),
                        }))
                        .addOperation(Operation.endSponsoringFutureReserves({
                            source: targetKeypair.publicKey(),
                        }))
                        .addOperation(Operation.payment({
                            asset: myAsset,
                            amount: '100',
                            destination: targetKeypair.publicKey(),
                        }))
                        .addOperation(Operation.clawback({
                            asset: myAsset,
                            amount: '10',
                            from: targetKeypair.publicKey(),
                        }))
                        .setTimeout(0)
                        .build();

                    clawbackTransaction.sign(challengeKeypair, targetKeypair);
                    return server.submitTransaction(clawbackTransaction);
                })
                .then(() => {
                    console.log('Challenge5: done!')
                })
                .then(
                    () => server.loadAccount(challengeKeypair.publicKey()),
                    err => { console.log(err); }
                );
        });
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ0305_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
