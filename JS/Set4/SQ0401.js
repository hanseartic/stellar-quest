const { Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const accounts = [
    {secret: 'SBWFWZHWB7A3EBCB5JCX4C2LBYY24MS56M6J3DA37HCOPXAS3E6YPZA5', preImage: '🐹',},
    {secret: 'SAK7SNF46OPI54ODIC6EAHJYDNUAK65M63MBQWBSFKLDLAQLI7XP4R5Q', preImage: '🐷',},
    {secret: 'SDXHYV4JBQ3CS5VSV7XUG5P2334G5CYWYLBFAAOXOBCROAQVY5TLZOTE', preImage: '👚',},
    {secret: 'SA2EV6NOGXYKI2WLLSS7Q3QTIAX5LR57YF3QGWO4DIFC3GXAPMVECREI', preImage: '👛',},
    {secret: 'SB7HYY3VVH62TUG6CF37HA3KKUQLRWLTE3HMU5QBHPLMDE5KXXPHPPT2', preImage: '🆚',},
];

const challenge = (accounts, target) => {
    accounts.forEach(({secret, preImage}) => {
        const accountKey = Keypair.fromSecret(secret);
        const preImageSigner = Buffer.from(preImage);
        console.log(accountKey.publicKey(), preImageSigner);

        server.loadAccount(accountKey.publicKey())
            .then(a => new TransactionBuilder(a, transactionOptions)
                .addOperation(Operation.accountMerge({
                    destination: target,
                }))
                .setTimeout(0)
                .build())
            .then(transaction => {
                transaction.sign(accountKey);
                transaction.signHashX(preImageSigner);
                return transaction;
            })
            .then(signedTX => server.submitTransaction(signedTX))
            .then(() => {
                console.log('claimed ' + accountKey.publicKey());
            })
            .catch((e) => {
                console.log(`could not claim ${secret}:${accountKey.publicKey()} ${e}`);
            });
    });
}

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    const readVar = require('../readVar');
    challengeKeypair('account to merge', 'SQ0401_SECRET_KEY')
        .then(keypair => readVar('Please provide the pre-image: ', 'SQ0401_PREIMAGE')
            .then(preImage => ({keypair, preImage})))
        .then(args => readVar('Please enter the target account: ', 'SQ04_TARGET')
            .then(target => ({...args, target: target}))
        )
        .then(({keypair, preImage, target}) => challenge([{secret: keypair.secret(), preImage: preImage}], target))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
