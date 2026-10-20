let audioCtx = null
let mediaSource = null
let analyser = null
let animFrameId = null
let visualizerRunning = false
let activeCanvas = null
let activeAnalyser = null
let activeIsPlayingRef = null

export function initWebAudio(audioElement, canvasElement, isPlayingRef) {
  if (canvasElement) activeCanvas = canvasElement
  if (isPlayingRef) activeIsPlayingRef = isPlayingRef

  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    triggerVisualizer()
    return
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    audioCtx = new AudioContextClass()
    mediaSource = audioCtx.createMediaElementSource(audioElement)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    activeAnalyser = analyser

    mediaSource.connect(analyser)
    analyser.connect(audioCtx.destination)

    triggerVisualizer()
  } catch (e) {
    console.warn('AudioContext fallback to HTML5 audio', e)
  }
}

export function triggerVisualizer() {
  if (!activeCanvas || !activeAnalyser || !activeIsPlayingRef) return

  if (activeIsPlayingRef.current) {
    if (!visualizerRunning) {
      visualizerRunning = true
      startVisualizerLoop(activeCanvas, activeAnalyser, activeIsPlayingRef)
    }
  } else {
    stopVisualizerLoop(activeCanvas)
  }
}

function stopVisualizerLoop(canvas) {
  visualizerRunning = false
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const barWidth = canvas.width / 8 - 1.5
  let x = 0
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = '#1e2922'
    ctx.fillRect(x, canvas.height - 2, barWidth, 2)
    x += barWidth + 1.5
  }
}

function startVisualizerLoop(canvas, analyserNode, isPlayingRef) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const bufferLength = analyserNode.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  function renderFrame() {
    if (!isPlayingRef.current) {
      stopVisualizerLoop(canvas)
      return
    }

    animFrameId = requestAnimationFrame(renderFrame)
    analyserNode.getByteFrequencyData(dataArray)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const barWidth = canvas.width / 8 - 1.5
    let x = 0

    for (let i = 0; i < 8; i++) {
      const val = dataArray[i * 2] || 0
      const barHeight = Math.max(2, (val / 255) * canvas.height)
      ctx.fillStyle = '#10b981'
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
      x += barWidth + 1.5
    }
  }

  animFrameId = requestAnimationFrame(renderFrame)
}
