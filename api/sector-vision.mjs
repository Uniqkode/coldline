// Optional evaluated Azure ML / AKS vision model. No trained model is bundled or claimed.
export async function sectorObservations(input, credential, env = process.env, fetchImpl = fetch) {
  if (!env.COLDLINE_VISION_ENDPOINT) return input;
  const images = input.inputs.filter(source => source.kind === 'image');
  if (!images.length) return input;
  const url = new URL(env.COLDLINE_VISION_ENDPOINT);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (!url.hostname.endsWith('.inference.ml.azure.com') && url.hostname !== env.COLDLINE_INFERENCE_HOST)) throw new Error('Use a configured HTTPS Azure ML or explicitly allowed inference host.');
  const token = await credential.getToken(env.COLDLINE_INFERENCE_SCOPE || 'https://ml.azure.com/.default');
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.token }, body: JSON.stringify({ images: images.map(source => ({ source: source.id, image: source.image })) }), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('The configured sector model could not complete inference.');
  const body = await response.json();
  if (!Array.isArray(body.observations) || !body.observations.length || body.observations.length > 16) throw new Error('The sector model returned an invalid observation list.');
  const ids = new Set(images.map(source => source.id));
  if (body.observations.some(item => !ids.has(item.source) || typeof item.observation !== 'string' || !item.observation.trim() || item.observation.length > 1000)) throw new Error('A sector-model observation has no valid source image.');
  let id = 'M1'; while (input.inputs.some(source => source.id === id)) id = 'M' + (Number(id.slice(1)) + 1);
  // Reserve one of the eight evidence slots for derived observations when this optional adapter is enabled.
  if (input.inputs.length >= 8) throw new Error('Use at most seven evidence inputs when sector-model observations are enabled.');
  return { ...input, inputs: [...input.inputs, { id, name: 'Configured sector-model observations (verify against the original images)', kind: 'text', text: body.observations.map(item => `Image ${item.source}: ${item.observation}`).join('\n') }] };
}
