const { Memo, Operation, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');
const { AccountHelper, SupportedNetworks } = require('stellar-account-helper')
const sha256 = require('sha256');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return SupportedNetworks.LIVENET.getServer().transactions()
                .transaction('3b00ce719e8c4f4d2218944fd60a78d2da83356f55c38ab733e0a46e386e25df').call()
                .then(transaction => transaction.operations())
                .then(({records}) => records.find(r => r.type === 'manage_data' && r.name === 'SQ0303_CLUE' && r.value !== '')?.value??'')
                .then(atob)
                .then(sq0303Clue => server.transactions().forAccount(account.id).limit(100).call()
                    .then(({records}) =>  ({transactions: records, clue: sq0303Clue})))
                .then(({transactions, clue}) => transactions
                    .map(t => t.signatures.map(s => atob(s)).find(s => s === clue))
                    .filter(Boolean))
                .then(signatures => new Promise((resolve, reject) => {
                    signatures.length >= 1
                        ? resolve('Found a correctly signed transaction')
                        : reject('Did not find a transaction signed with the correct hash')
                }));
        });
}
const challenge = async (challengeKeypair, challengeRiddle) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge3: Found correct operation -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge3: Could not load account. Creating now.')
                return new AccountHelper(challengeKeypair.secret())
                    .getFunded({sponsorKeypair: challengeKeypair})
                    .then(() => challenge(challengeKeypair, challengeRiddle));
            }
            console.log('Challenge3: Running challenge!');
            const signerHash = sha256(challengeRiddle);
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addMemo(Memo.text('hanseartic/stellar-quest'))
                    .addOperation(Operation.setOptions({
                        signer: {
                            sha256Hash: signerHash,
                            weight: "1",
                        },
                    }))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                })
                // reload account for correct sequence
                .then(() => server.loadAccount(challengeKeypair.publicKey()))
                .then(account => new TransactionBuilder(account, transactionOptions)
                    .addMemo(Memo.text('hanseartic/stellar-quest'))
                    .addOperation(Operation.setOptions({
                        signer: {
                            sha256Hash: signerHash,
                            weight: "0",
                        },
                    }))
                    .setTimeout(0)
                    .build()
                )
                .then(signedWithHashTransaction => {
                    signedWithHashTransaction.signHashX(new Buffer(challengeRiddle).toString('hex'));
                    return server.submitTransaction(signedWithHashTransaction)
                })
                .then(() => server.loadAccount(challengeKeypair.publicKey()), err => { console.log(err) })
        })
        .then(() => {console.log('Challenge3: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    const readVar = require('../readVar');
    challengeKeypair('Quest Keypair', 'SQ0301_SECRET_KEY')
        .then(keypair => readVar('Please enter the desired signer: ', 'SQ0303_RIDDLE')
            .then(riddle => ({keypair, riddle}))
        )
        .then(({keypair, riddle}) => challenge(keypair, riddle))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
