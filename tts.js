const { spawn } = require('node:child_process');

const python = spawn(
	'wayu-env\\Scripts\\python.exe',
	['-X', 'utf8', 'tts_worker.py'],
	{
		stdio: ['pipe', 'pipe', 'inherit'],
	}
);

python.stdout.on('data', (data) => {
	console.log('[TTS]', data.toString().trim());
});

function speak(text) {
	return new Promise((resolve, reject) => {
		python.stdin.write(text + '\n');

		const onData = (data) => {
			const output = data.toString();

			if (output.includes('DONE')) {
				python.stdout.off('data', onData);
				resolve('worker-test.wav');
			}
		};

		python.stdout.on('data', onData);

		python.stdin.once('error', reject);
	});
}

module.exports = {
	speak,
};