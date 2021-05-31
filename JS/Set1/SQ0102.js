const { Asset, Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { filter, find } = require('lodash');
const BigNumber = require('bignumber.js');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.payments())
        .then(ops => !!find(
            filter(ops.records, (payment) => payment.type === 'payment'),
            (payment) => payment.to !== publicKey && new BigNumber(payment.amount).eq(10)))
        .catch(err => err);
};

const challenge = async (challengeKeypair) => {
    console.log('Challenge2: starting');

    return verifyChallenge(challengeKeypair.publicKey())
        .then(isChallengeVerified => {
            return isChallengeVerified instanceof Error ?
                isChallengeVerified :
                server.loadAccount(challengeKeypair.publicKey())
                    .then(account => {
                        if (isChallengeVerified === true) {
                            console.log('Challenge2: already done -> skipping');
                            return account;
                        }

                        const destC2Account = Keypair.random();
                        return server.friendbot(destC2Account.publicKey())
                            .call()
                            .then(() => server.loadAccount(destC2Account.publicKey()))
                            .then((destinationAccount) => {
                                const transaction = new TransactionBuilder(account, transactionOptions)
                                    .addOperation(Operation.payment({
                                        destination: destinationAccount.accountId(),
                                        asset: Asset.native(),
                                        amount: '10',
                                    }))
                                    .setTimeout(0)
                                    .build();
                                transaction.sign(challengeKeypair);
                                return server.submitTransaction(transaction);
                            })
                            .then(() => {
                                console.log('Succesfully submitted transaction.');
                                return server.loadAccount(account.id);
                            });
                    })
                    .then(account => {
                        console.log('Challenge2: done');
                        return account;
                    });

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
