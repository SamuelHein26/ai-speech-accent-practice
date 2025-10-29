class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0];
      const copy = new Float32Array(channelData);
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
