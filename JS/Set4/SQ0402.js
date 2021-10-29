const { Asset, BASE_FEE, Keypair, Networks, Operation, Server, TransactionBuilder } = require('stellar-sdk');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const server = new Server('https://horizon.stellar.org');
const transactionOptions = {fee: BASE_FEE, networkPassphrase: Networks.PUBLIC}
const lobbyAccounts = [
/*
    {secret: 'S…', },
/*/
];

const cbAsset = new Asset('SQuid', 'GCCDCZZP7AGSP2F2VRKDBLMXSQPRGR5MRITY2HUWQ3KIS6M6B436IUUF');

const challenge = (accounts, target, authToken = '') => {
    accounts.forEach(({secret}) => {
        const accountKey = Keypair.fromSecret(secret);
        console.log(accountKey.publicKey());

        return server.loadAccount(accountKey.publicKey())
            .then(async account => {
                const transactionBuilder = new TransactionBuilder(account, transactionOptions)
                    .setTimeout(0)
                    .addOperation(Operation.changeTrust({
                        asset: cbAsset,
                    }));
                const claimableBalanceIds = await server.claimableBalances().claimant(account.accountId()).call()
                    .then(({records}) => records
                        .filter(r => r.asset === `${cbAsset.getCode()}:${cbAsset.getIssuer()}`)
                        .map(r => ({id: r.id, amount: new BigNumber(r.amount),}))
                    );
                let cbAmount = new BigNumber(0);
                claimableBalanceIds.forEach(({id, amount}) => {
                    cbAmount = cbAmount.add(amount);
                    transactionBuilder.addOperation(Operation.claimClaimableBalance({balanceId: id}));
                });
                if (!cbAmount.isZero()) {
                    transactionBuilder
                        .addOperation(Operation.pathPaymentStrictSend({
                            destAsset: Asset.native(),
                            destination: account.accountId(),
                            sendAmount: cbAmount.toString(),
                            sendAsset: cbAsset,
                        }));
                }
                transactionBuilder
                    .addOperation(Operation.changeTrust({
                        asset: cbAsset,
                        limit: "0",
                    }))
                    .addOperation(Operation.accountMerge({destination: target}));
                return transactionBuilder.build();
            })
            .then(tx => {
                tx.sign(accountKey);
                console.log(`Claiming ${accountKey.publicKey()} (${accountKey.secret().substr(0, 4)}…)with following XDR \n\n ${tx.toXDR()}\n\n`);
                return tx.toXDR();
            })
            .then(xdr => fetch('https://api.stellar.quest/answer/sign', {
                method: 'POST',
                body: JSON.stringify({xdr: xdr}),
                headers: {'Authorization': `Bearer ${authToken}`},
                })
                .then(res => res.json())
                .catch(console.warn)
            )
            .catch(e => console.warn(e?.response??e, accountKey.publicKey()));
    });
}

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    const readVar = require('../readVar');
    challengeKeypair('account to merge', 'SQ0402_SECRET_KEY')
        .then(keypair => ([{secret: keypair.secret()}]))
        .catch(() => {
            console.warn('\nProvided secret was invalid.');
            console.warn('Using fixed list of lobby accounts (see source code) as fallback.\n');
            return lobbyAccounts;
        })
        .then(accounts => readVar('Please enter the target account: ', 'SQ04_TARGET')
            .then(target => ({accounts: accounts, target}))
        )
        .then(args => readVar('Please enter the authorization token from the quest page. You can find it in the browser\'s dev-tools. If you omit it, you can still copy/paste the XDR the quest-site: ', 'SQ_AUTH_TOKEN')
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
