const express = require('express');

const app = express();
const port = 4321;

app.get('/verify/:quest/:account_id', (req, res) => {
    const accountId = req.params.account_id;
    const quest = req.params.quest;
    const setNo = parseInt(quest.match(/SQ(\d{2})(\d{2})/)[1]);
    try {
        const { verify } = require(`./Set${setNo}/${quest}`);
        process.stdout.write(`Verifying ${quest} for account ${accountId}: `);
        return verify(accountId)
            .then(result => {
                process.stdout.write(result+"\n");
                return res.json({ account: accountId, verified: result});
            });
    } catch (err) {
        process.stdout.write("Quest does not exist\n");
        res.statusCode = 404;
        return res.send(`Quest ${quest} not found.`);
    }
});

app.listen(port, () => {
    console.log(`Starting verifying server on port ${port}.`);
});
