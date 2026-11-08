import { tagMp4 } from './audioTagger.js'

self.addEventListener('message', ({ data }) => {
  try {
    const tagged = tagMp4(new Uint8Array(data.audio), {
      ...data.metadata,
      cover: new Uint8Array(data.cover)
    })
    self.postMessage({ tagged: tagged.buffer }, [tagged.buffer])
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'MP4 tagging failed.'
    })
  }
})
