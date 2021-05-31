const { TransactionBuilder, Asset, Operation, } = require('stellar-sdk');
const { find } = require('lodash');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.offers({order: 'asc', limit: 200}))
        .then(offers => !!find(
            offers.records,
            (offer) => offer.seller === publicKey
                && offer.selling.asset_type !== 'native'
                && offer.buying.asset_type === 'native'
        ))
        .catch(err => err);
};

const challenge = async (challengeKeypair) => {
    console.log('Challenge6: starting');
    const isChallengeVerified = await verifyChallenge(challengeKeypair.publicKey());
    if (isChallengeVerified instanceof Error)
        return isChallengeVerified;

    return await server.loadAccount(challengeKeypair.publicKey())
        .then(challengeAccount => {
            if (isChallengeVerified === true) {
                console.log('Sell offer is already present -> skipping');
                return challengeAccount;
            }
            const { asset: customAsset } = require('./SQ0105');
            const customAssetBalance = find(challengeAccount.balances, (balance) => balance.asset_code === customAsset.code);
            if (customAssetBalance) {
                const transaction = new TransactionBuilder(challengeAccount, transactionOptions)
                    .addOperation(Operation.manageSellOffer({
                        selling: customAsset,
                        buying: Asset.native(),
                        amount: customAssetBalance.balance,
                        price: '1',
                    }))
                    .setTimeout(0)
                    .build();
                transaction.sign(challengeKeypair);
                return server.submitTransaction(transaction)
                    .then(() => {
                        console.log('Successfully placed sell-offer');
                        return server.loadAccount(challengeKeypair.publicKey())
                    });
            }
            console.log('No custom asset available. Run Challenge5 first.');
            return challengeAccount;
        })
        .then(challengeAccount => {
            console.log('Challenge6: done');
            return challengeAccount;
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
