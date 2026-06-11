function isPdfBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 5) return false;
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

module.exports = {
    isPdfBuffer,
};
