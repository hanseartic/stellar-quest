module.exports = (account, length = 12) => {
    return account.substr(0, Math.floor(length/2)) + '…' + account.substr(-Math.ceil(length/2));
};
