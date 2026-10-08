const providers = {
	wayu: require('./providers/wayu'),
};

const providerName = process.env.TTS_PROVIDER || 'wayu';

const provider = providers[providerName];

if (!provider) {
	throw new Error(`ไม่พบ TTS provider: ${providerName}`);
}

console.log('TTS Provider:', providerName);

module.exports = provider;