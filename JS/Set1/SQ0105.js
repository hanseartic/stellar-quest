const { TransactionBuilder, Asset, Operation, } = require("stellar-sdk");
const { find } = require('lodash');
const BigNumber = require('bignumber.js');
const challengeKeypair = require('../challengeKeypair');
const { server, transactionOptions } = require('./../testserver.js');
const issuerKeypair = () => challengeKeypair("Custom asset's issuer Keypair", 'SQ0105_ISSUER_SECRET_KEY');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => !!find(
            account.balances,
            (asset) => asset.asset_type !== 'native' && new BigNumber(asset.balance).gt(0)))
        .catch(err => err);
};

const challenge = async (challengeKeypair, issuerKeypair) => {
    console.log('Challenge5: starting');
    const isChallengeVerified = await verifyChallenge(challengeKeypair.publicKey());
    if (isChallengeVerified instanceof Error)
        return isChallengeVerified;

    return await server.loadAccount(challengeKeypair.publicKey())
        .then(challengeAccount => {
            if (isChallengeVerified === true) {
                console.log('Account already has received a custom asset -> skipping')
                return challengeAccount;
            }

            return server.loadAccount(issuerKeypair.publicKey())
                .catch(() => {
                    console.log('Issuing account does not exist. Asking a friend for help');
                    return server.friendbot(issuerKeypair.publicKey())
                        .call()
                        .then(() => server.loadAccount(issuerKeypair.publicKey()));
                })
                .then(issuingAccount => {
                    const transaction = new TransactionBuilder(issuingAccount, transactionOptions)
                        .addOperation(Operation.changeTrust({
                            asset: customAsset,
                            limit: '0.0000001',
                            source: challengeAccount.accountId(),
                        }))
                        .addOperation(Operation.payment({
                            asset: customAsset,
                            amount: '0.0000001',
                            destination: challengeAccount.accountId(),
                        }))
                        .setTimeout(0)
                        .build();
                    const issuerCanSignChallengeAccount = !!find(
                        challengeAccount.signers,
                        (signer) => signer.type === 'ed25519_public_key' && signer.key === issuerKeypair.publicKey());
                    if (!issuerCanSignChallengeAccount) {
                        transaction.sign(challengeKeypair);
                    } else {
                        console.log('The asset issuer can sign for us, yey');
                    }
                    transaction.sign(issuerKeypair);
                    return server.submitTransaction(transaction)
                        .then(() => server.loadAccount(challengeKeypair.publicKey()));
                });
        })
        .then(account => {
            console.log('Challenge5: done')
            return account;
        });
};

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    challengeKeypair('Challenge Keypair', 'SQ01_SECRET_KEY')
        .then(keypair => issuerKeypair().then(additionalKeypair => ({keypair: keypair, issuerKeypair: additionalKeypair})))
        .then(({keypair, issuerKeypair}) => challenge(keypair, issuerKeypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
} else {
    module.exports = { quest: challenge, verify: verifyChallenge };
    issuerKeypair()
        .then(additionalKeypair => {
            module.exports.asset = new Asset('SQ0105', additionalKeypair.publicKey());
            console.log(module.exports.asset);
        });
}
