const { AccountResponse, BASE_FEE,  Networks, Operation, Server, TransactionBuilder } = require('stellar-sdk');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const server = new Server('https://horizon.stellar.org');
const transactionOptions = {
    fee: new BigNumber(BASE_FEE).times(1000000).toString(),
    networkPassphrase: Networks.PUBLIC,
}
const shorten = require('../shorten');

const fixedXDRs = [
    /*
    'AAAAAgAAA…',
     */
];

const claimAccount = (accountId, targetAccount, authToken) => {
    console.log(`Trying to merge stash account [${shorten(accountId)}] into target [${shorten(targetAccount, 18)}].`);
    return server.loadAccount(accountId)
        .then(accountToMerge => {
            const t = new TransactionBuilder(accountToMerge, transactionOptions)
                .setTimeout(0)
                .addOperation(Operation.accountMerge({
                    destination: targetAccount,
                }))
                .build();
            console.log(accountToMerge.balances[0].balance);
            console.log(t.toXDR());
            return fetch(
                'https://api.stellar.quest/answer/sign',
                {
                    method: 'POST',
                    body: JSON.stringify({xdr: t.toXDR()}),
                    headers: {'Authorization': `Bearer ${authToken}`},
                })
                .then(res => res.json())
                .then(jsonResponse => {
                    console.log(jsonResponse);
                    return t.toXDR();
                });
        })
}

const inspectXDR = (xdr) => {
    const t = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC);
    return {
        sourceAccount:  t.source,
        sourceSequence: t.operations.find(op => op.type === 'bumpSequence')?.bumpTo,
        stashAccount:   t.operations.find(op => op.source)?.source,
        memo:           t.memo?.value??''
    };
}

const challenge = (xdrs, target, authToken = '') => {
    xdrs.forEach(xdr => {
        const { sourceAccount, sourceSequence, stashAccount, memo} = inspectXDR(xdr);

        console.log(`\nTaking the [${memo}]: [${shorten(sourceAccount, 19)} @ ${sourceSequence}] => [${shorten(stashAccount, 6)}].`);

        claimAccount(stashAccount, target)
            .catch(e => {
                if (e.response?.status === 404)  console.log(`Stash account [${shorten(stashAccount)}] does not exist - trying to submit initial XDR.`);
                else console.log(e);
                return server.loadAccount(sourceAccount)
                    .then(a => fetch(
                        'https://api.stellar.quest/answer/sign',
                        {
                            method: 'POST',
                            body: JSON.stringify({xdr: xdr}),
                            headers: {'Authorization': `Bearer ${authToken}`},
                        })
                        .then(() => console.log(`Submitted initial XDR for ${a.id}.`))
                        // calling challenge again on this account to actually claim the price
                        .then(() => claimAccount(stashAccount, target, authToken))
                        .catch(console.warn)
                    )
                    .catch(e => {
                        if (e.response?.status === 404) {
                            console.log(`Source account [${shorten(sourceAccount, 11)}] does not exist - Challenge already taken.`);
                        } else {
                            console.warn(e);
                        }
                    });
            });
    });
}

if (require.main === module) {
    const readVar = require('../readVar');
    readVar('XDR : ', 'SQ0404_XDR')
        .then(xdr => xdr?[xdr]:fixedXDRs)
        .then(xdrs => readVar('Where should the prize go: ', 'SQ04_TARGET')
            .then(target => ({xdrs: xdrs, target}))
        )
        .then(args => readVar('Please enter the authorization token from the quest page. You can find it in the browser\'s dev-tools. If you omit it, you can still copy/paste the XDR into the quest-site\s submission form: ', 'SQ_AUTH_TOKEN')
            .then(token => ({...args, token}))
        )
        .then(({xdrs, target, token}) => challenge(xdrs, target, token))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res?.response??res);
            }
        });
}
