import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { audio, command } = event.data;

    if (command === 'transcribe') {
        try {
            self.postMessage({ status: 'init' });

            let transcriber = await PipelineSingleton.getInstance((progress) => {
                self.postMessage({ status: 'progress', progress });
            });

            self.postMessage({ status: 'processing' });

            let result = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: 'english',
                task: 'transcribe',
            });

            self.postMessage({
                status: 'complete',
                text: result.text
            });

        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
