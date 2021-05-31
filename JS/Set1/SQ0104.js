const { Keypair, Networks, Operation, TransactionBuilder } = require('stellar-sdk');
const { filter, find } = require('lodash');
const challengeKeypair = require('../challengeKeypair');
const { server, transactionOptions } = require('./../testserver.js');

const additionalSignerKeypair = () => challengeKeypair('Additional Signer Keypair', 'SQ0104_ADDITIONAL_SIGNER');

const verifyChallenge = async (publicKey) => {
    const keypairHint = Keypair.fromPublicKey(publicKey).signatureHint();
    return await server.loadAccount(publicKey)
        .then(account => account.operations({order: 'desc', limit: 200}))
        .then(ops => {
            const mdr = find(
                filter(ops.records, (record) => record.type === 'manage_data'),
                (manageDataRecord) => manageDataRecord.source_account === publicKey);
            return !!mdr
                ? mdr.transaction()
                    .then(t => !!TransactionBuilder.fromXDR(t.envelope_xdr, Networks.TESTNET).signatures
                        .find(signature => signature.hint() !== keypairHint))
                : false;
        })
        .catch(err => err);
};

const challenge = async (challengeKeypair, additionalSignerKeypair) => {
    console.log('Challenge4: starting');
    return verifyChallenge(challengeKeypair.publicKey())
        .then(isChallengeVerified => {
            return isChallengeVerified instanceof Error
                ? isChallengeVerified
                : server.loadAccount(challengeKeypair.publicKey())
                    .then(account => {
                        if (isChallengeVerified === true) {
                            console.log('There is already a multisig operation -> skipping')
                            return account;
                        }

                        const transaction = new TransactionBuilder(account, transactionOptions)
                            .addOperation(Operation.setOptions({
                                signer: {
                                    ed25519PublicKey: additionalSignerKeypair.publicKey(),
                                    weight: 1,
                                }
                            }))
                            .setTimeout(0)
                            .build();
                        transaction.sign(challengeKeypair);
                        return server.submitTransaction(transaction).then(() => account).then(account => {
                            const multisigTransaction = new TransactionBuilder(account, transactionOptions)
                                .addOperation(Operation.manageData({
                                    name: "multisig data entry",
                                    value: 'true',
                                }))
                                .setTimeout(0)
                                .build();
                            multisigTransaction.sign(additionalSignerKeypair);
                            return server.submitTransaction(multisigTransaction).then(() => server.loadAccount(challengeKeypair.publicKey()))
                        });
                    });
        })
        .then(result => {
            console.log('Challenge4: done');
            return result;
        });
};

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    challengeKeypair('Challenge Keypair', 'SQ01_SECRET_KEY')
        .then(keypair => additionalSignerKeypair().then(additionalKeypair => ({keypair: keypair, additionalKeypair: additionalKeypair})))
        .then(({keypair, additionalKeypair}) => challenge(keypair, additionalKeypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
} else {
    module.exports = { quest: challenge, verify: verifyChallenge, };
}
