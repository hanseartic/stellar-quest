const zerofill = require('zero-fill');

module.exports = (data, indexSize = 2, chunkSize = 64) => {
    const nameChunkSize = chunkSize - indexSize;
    let chunks = [];
    let offset = 0;
    do {
        const index = zerofill(indexSize, chunks.length);
        const nameEntry = data.slice(offset, offset + nameChunkSize);
        const dataEntry = data.substr(offset + nameChunkSize, chunkSize) || '';
        chunks.push({
            name: `${index}${nameEntry}`,
            value: dataEntry,
        });
        offset = chunks.length * (2 * chunkSize - indexSize);
    } while (offset < data.length)
    return chunks;
};
