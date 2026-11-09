const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'main_project', 'data');
const lowDir = path.join(root, 'main_project', 'images', 'parks', 'low');
const highDir = path.join(root, 'main_project', 'images', 'parks', 'high');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const apiKey = env.match(/^NATIONAL_API_KEY=(.*)$/m)?.[1]?.trim();
const existingMetadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf8'));
const officialCodes = [...existingMetadata.parkCodes].sort();

function names(value) {
  return Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item.name).filter(Boolean) : [];
}

function localImage(code, index, folder) {
  const file = path.join(folder, `${code}_${index}.jpg`);
  return fs.existsSync(file) ? `/images/parks/${path.basename(folder)}/${code}_${index}.jpg` : null;
}

async function main() {
  if (!apiKey) throw new Error('NATIONAL_API_KEY is missing from .env');
  const response = await fetch('https://developer.nps.gov/api/v1/parks?limit=500', { headers: { 'X-Api-Key': apiKey } });
  if (!response.ok) throw new Error(`NPS API returned ${response.status}`);
  const payload = await response.json();
  const byCode = new Map(payload.data.map(park => [park.parkCode, park]));
  const sourceCodes = new Set(officialCodes.filter(code => code !== 'kica'));
  const missing = [...sourceCodes].filter(code => !byCode.has(code));
  if (missing.length) throw new Error(`NPS API did not return: ${missing.join(', ')}`);

  const sourceRecords = officialCodes
    .filter(code => code !== 'kica')
    .map(code => byCode.get(code));
  const records = [];

  for (const source of sourceRecords) {
    const variants = source.parkCode === 'seki'
      ? [{ code: 'seki', name: 'Sequoia National Park' }, { code: 'kica', name: 'Kings Canyon National Park' }]
      : [{ code: source.parkCode, name: source.fullName }];

    for (const variant of variants) {
      const images = (source.images || []).map((image, index) => ({
        url: image.url,
        altText: image.altText || variant.name,
        title: image.title || variant.name,
        caption: image.caption || '',
        localUrlLow: localImage(variant.code, index, lowDir) || localImage('seki', index, lowDir),
        localUrlHigh: localImage(variant.code, index, highDir) || localImage('seki', index, highDir),
        originalUrl: image.url
      }));

      records.push({
        parkCode: variant.code,
        fullName: variant.name,
        description: source.description || '',
        latLong: source.latLong || `lat:${source.latitude}, long:${source.longitude}`,
        states: source.states || '',
        url: source.url || `https://www.nps.gov/${source.parkCode}/index.htm`,
        weatherInfo: source.weatherInfo || '',
        directionsInfo: source.directionsInfo || '',
        directionsUrl: source.directionsUrl || '',
        images,
        activities: names(source.activities),
        topics: names(source.topics),
        contacts: source.contacts || { phoneNumbers: [], emailAddresses: [] },
        entranceFees: source.entranceFees || [],
        operatingHours: source.operatingHours || [],
        designation: source.designation || 'National Park'
      });
    }
  }

  records.sort((a, b) => a.fullName.localeCompare(b.fullName));
  records.forEach((park, index) => { park.parkId = index + 1; });

  const missingImageRecords = records.filter(park => !park.images.some(image => image.localUrlLow));
  for (const park of missingImageRecords) {
    const image = park.images[0];
    if (!image?.url) continue;
    const [low, high] = await Promise.all([fetch(image.url), fetch(image.url)]);
    if (!low.ok || !high.ok) continue;
    const [lowBuffer, highBuffer] = await Promise.all([low.arrayBuffer(), high.arrayBuffer()]);
    await sharp(Buffer.from(lowBuffer)).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(path.join(lowDir, `${park.parkCode}_0.jpg`));
    await sharp(Buffer.from(highBuffer)).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(highDir, `${park.parkCode}_0.jpg`));
    image.localUrlLow = `/images/parks/low/${park.parkCode}_0.jpg`;
    image.localUrlHigh = `/images/parks/high/${park.parkCode}_0.jpg`;
  }

  fs.writeFileSync(path.join(dataDir, 'nationalParks.json'), JSON.stringify(records, null, 2) + '\n');
  fs.writeFileSync(path.join(dataDir, 'metadata.json'), JSON.stringify({
    lastUpdated: new Date().toISOString(),
    totalParks: records.length,
    parkCodes: records.map(park => park.parkCode),
    source: 'National Park Service API',
    sharedCoordinateGroups: [['seki', 'kica']]
  }, null, 2) + '\n');
  console.log(`Wrote ${records.length} park records and ${missingImageRecords.length} image sets.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
