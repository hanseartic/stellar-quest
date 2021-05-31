const { TransactionBuilder, Asset, Operation } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const assetSRT = new Asset('SRT', 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.operations({limit: 200}))
        .then(({records}) => records.filter(record => record.type === 'path_payment_strict_send')
        )
        .then(records => records.filter(record =>
                record.from === publicKey &&
                record.to === publicKey &&
                record.asset_code === assetSRT.code &&
                record.asset_issuer === assetSRT.issuer
        ))
        .then(pathPaymentRecords => !!pathPaymentRecords.length)
        .catch(err => err);
};

const challenge = async (challengeKeypair) => {
    console.log('Challenge8: starting');
    const isChallengeVerified = await verifyChallenge(challengeKeypair.publicKey());
    if (isChallengeVerified instanceof Error)
        return isChallengeVerified;
    return server.loadAccount(challengeKeypair.publicKey())
        .then(account => {
            if (isChallengeVerified === true) {
                console.log('There is already a valid path payment -> skipping');
                return account;
            }
            const transaction = new TransactionBuilder(account, transactionOptions)
                .addOperation(Operation.changeTrust({ asset: assetSRT }))
                .addOperation(Operation.pathPaymentStrictSend({
                    destination: challengeKeypair.publicKey(),
                    sendAsset: Asset.native(),
                    destAsset: assetSRT,
                    sendAmount: '10',
                    destMin: '0.0000001',
                    path: [],
                }))
                .setTimeout(0)
                .build();
            transaction.sign(challengeKeypair);
            return server.submitTransaction(transaction)
                .then(() => {
                    console.log('successfully submitted path-payment transaction');
                    return server.loadAccount(challengeKeypair.publicKey());
                });
        })
        .then(account => {
            console.log('Challenge8: done');
            return account;
        });

};
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Challenge Keypair', 'SQ01_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
