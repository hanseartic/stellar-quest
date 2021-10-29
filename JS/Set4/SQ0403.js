const { AccountResponse, BASE_FEE, Keypair, Networks, Operation, Server, StrKey, TransactionBuilder } = require('stellar-sdk');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const server = new Server('https://horizon.stellar.org');
const transactionOptions = {
    fee: new BigNumber(BASE_FEE).times(10000).toString(),
    networkPassphrase: Networks.PUBLIC
}

const lobbyAccounts = [
    /*
    {secret: 'S…', stroops: "10000000"},
     */
];

const challenge = (accounts, target, authToken = '') => {
    accounts.forEach(({secret, stroops}) => {
        const accountKey = Keypair.fromSecret(secret);
        console.log(`working ${accountKey.publicKey()} (…${accountKey.secret().substr(-5)})`);
        transactionOptions.fee = stroops;
        return server.loadAccount(accountKey.publicKey())
            .then(async account => {
                const unlockTx = new TransactionBuilder(account, transactionOptions)
                    .setTimeout(0)
                    .addOperation(Operation.setOptions({masterWeight: '1',}))
                    .build();
                const claimTx = new TransactionBuilder(account, transactionOptions)
                    .setTimeout(0)
                    .addOperation(Operation.accountMerge({destination: target}))
                    .build();
                claimTx.sign(accountKey);
                return {unlock: unlockTx, claim: claimTx};
            })
            .then(({unlock, claim}) => {
                console.log(`Unlock account with TX ${StrKey.encodePreAuthTx(unlock.hash())}: ${unlock.toXDR()}`);
                console.log(`Claim account with XDR: ${claim.toXDR()}`);

                return fetch(
                    'https://api.stellar.quest/answer/sign',
                    {
                        method: 'POST',
                        body: JSON.stringify({xdr: unlock.toXDR()}),
                        headers: {'Authorization': `Bearer ${authToken}`},
                    })
                    .then(res => res.json())
                    .then(jsonResponse => {
                        console.log(jsonResponse);
                        return claim.toXDR();
                    });
            })
            .then(claimTxXDR => fetch(
                'https://api.stellar.quest/answer/sign',
                {
                    method: 'POST',
                    body: JSON.stringify({xdr: claimTxXDR}),
                    headers: {'Authorization': `Bearer ${authToken}`},
                }).then(res => res.json())
            )
            .catch(e => {
                console.warn(e?.response??e, accountKey.publicKey())
            });
    });
}

if (require.main === module) {
    const challengeKeypair = require('../challengeKeypair');
    const readVar = require('../readVar');
    challengeKeypair('account to claim (leave empty to use list from source code)', 'SQ0403_SECRET_KEY')
        .then(keypair => readVar('Stroops hint: ', 'SQ04_STROOPS').then(stroops => ({keypair: keypair, stroops: stroops})))
        .then(({keypair, stroops}) => ({secret: keypair.secret(), stroops: stroops}))
        .then(hints => ([hints]))
        .catch(() => {
            console.warn('\nProvided secret was invalid.');
            console.warn('Using fixed list of lobby accounts (see source code) as fallback.\n');
            return lobbyAccounts;
        })
        .then(accounts => readVar('Where should the prize go: ', 'SQ04_TARGET')
            .then(target => ({accounts: accounts, target}))
        )
        .then(args => readVar('Please enter the authorization token from the quest page. You can find it in the browser\'s dev-tools. If you omit it, you can still copy/paste the XDR into the quest-site\s submission form: ', 'SQ_AUTH_TOKEN')
            .then(token => ({...args, token}))
        )
        .then(({accounts, target, token}) => challenge(accounts, target, token))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res?.response??res);
            }
        });
}
