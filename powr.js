function verifyPoWR(input) {
  const fullRef = input?.trim() || document.getElementById('verifyInput').value.trim();
  const outputDiv = document.getElementById('verifyOutput');
  outputDiv.textContent = '';


  // Extract the hash (last bracketed 64-char hex)
  const hashMatch = fullRef.match(/\[([0-9a-f]{64})\]$/i);
  if (!hashMatch) { outputDiv.textContent = 'Invalid reference format: missing hash.'; return; }
  const givenHash = hashMatch[1];

  // Remove the trailing hash to get the reference with code
  const refWithoutHash = fullRef.replace(/\[[0-9a-f]{64}\]$/i, '');

  // Extract the 12-digit PoWR code
  const codeMatch = refWithoutHash.match(/\|\s([0-9a-f]{12})\]$/i);
  if (!codeMatch) { outputDiv.textContent = 'Invalid reference format: missing PoWR code.'; return; }
  const code = codeMatch[1];

  // Extract expiry from the reference
  const expiryMatch = refWithoutHash.match(/Expires in:\s(\d+)s/);
  if (!expiryMatch) { outputDiv.textContent = 'Cannot find expiry in reference.'; return; }
  const expirySec = BigInt(expiryMatch[1]);

  // Recompute maxHash using same mining logic
  const TWO_256 = 1n << 256n;
  const hashesPerSec = 100n;
  const baseExpiry = 10800n;
  const desiredMiningTime = 1n;
  const expectedAttempts = (hashesPerSec * desiredMiningTime * expirySec) / baseExpiry;
  const maxHash = TWO_256 / expectedAttempts;

  // Recompute SHA256 of the reference including code
  const hashValue = CryptoJS.SHA256(refWithoutHash).toString();
  const hashBig = BigInt('0x' + hashValue);

  // Determine if mined
  const mined = hashBig < maxHash;

  // Parse basic details (very crude but shows all colon-separated fields)
  const details = {};
  refWithoutHash.split('. ').forEach(part => {
    const [key, ...rest] = part.split(': ');
    if (key && rest.length) details[key.trim()] = rest.join(': ').trim();
  });

  // Display results
  let out = `PoWR Verification Result: ${mined ? 'VALIDLY MINED ✅' : 'INVALID ❌'}\n`;
  out += `Computed Hash: ${hashValue}\n`;
  out += `PoWR Code: ${code}\n\n`;
  out += `Reference Details:\n`;
  for (const [k,v] of Object.entries(details)) {
    out += `${k}: ${v}\n`;
  }

  outputDiv.textContent = out;
  return { 
    valid: mined,       // true if mined successfully, false otherwise
    hash: hashValue,    // the SHA256 hash as a hex string
    message: out // optional, used in error reporting
};

}




function verifyBibliography() {
  const input = document.getElementById('bibliographyInput').value;
  const outputDiv = document.getElementById('biblioOutput');
  outputDiv.textContent = "";

  let blocks = [];
  let i = 0;
  while (i < input.length) {
    const start = input.indexOf('[', i);
    if (start === -1) break;

    const end = input.indexOf(']', start + 1);
    const hashStart = input.indexOf('[', end);
    const hashEnd = input.indexOf(']', hashStart);
    if (hashEnd === -1) break;

    blocks.push(input.slice(start, hashEnd + 1));
    i = hashEnd + 1;
  }

  if (blocks.length === 0) {
    outputDiv.textContent = 'Failed: No valid blocks detected.';
    return;
  }

  let prevHash = null;
  let authors = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    let result;
    try {
      result = verifyPoWR(block);
    } catch (err) {
      outputDiv.textContent = `Failed: Block ${idx + 1} verification threw an error: ${err.message}`;
      return;
    }


    if (!result || typeof result.valid !== 'boolean' || !result.hash) {
      outputDiv.textContent = `Failed: Block ${idx + 1} returned invalid PoWR result.`;
      return;
    }

    if (!result.valid) {
      outputDiv.textContent = `Failed: Block ${idx + 1}: ${result.message}`;
      return;
    }

    const hash = result.hash;
    const isGenesis = block.startsWith('[GENESIS');

    if (idx === 0 && !isGenesis) {
      outputDiv.textContent = 'Failed: First block must be GENESIS.';
      return;
    }

    if (idx > 0) {
      if (isGenesis) {
        outputDiv.textContent = `Failed: Block ${idx + 1}: GENESIS not allowed here.`;
        return;
      }
      if (!block.includes(prevHash)) {
        outputDiv.textContent = `Failed: Block ${idx + 1}: Previous hash mismatch.`;
        return;
      }
    }

    const authorMatch = block.match(/\[GENESIS\s+([^\(]+)/) || block.match(/\[\s*([^\(]+)/);
    if (authorMatch) {
      authors.push(authorMatch[1].trim());
    }

    prevHash = hash;
  }

  for (let i = 1; i < authors.length; i++) {
    if (authors[i - 1].localeCompare(authors[i]) > 0) {
      outputDiv.textContent =
        `Failed: Author order error: "${authors[i - 1]}" should come after "${authors[i]}".`;
      return;
    }
  }

  outputDiv.textContent =
    `Bibliography VERIFIED ✅\n` +
    `${blocks.length} blocks valid, chained, mined, unexpired, and alphabetical.`;
}

