const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function processCities() {
  console.log('GeoNames Data Processor');
  console.log('======================\n');

  const inputFile = path.join(__dirname, '../temp_data/cities15000.txt');
  const outputFile = path.join(__dirname, '../data/cities15000.json');

  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error('❌ Error: cities15000.txt not found!');
    console.error(`   Expected location: ${inputFile}`);
    console.error('\nPlease download and extract cities15000.zip from:');
    console.error('http://download.geonames.org/export/dump/cities15000.zip');
    console.error('\nExtract cities15000.txt to the temp_data directory.');
    process.exit(1);
  }

  // Create data directory if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
  }

  console.log('📖 Reading GeoNames data...');
  const input = fs.createReadStream(inputFile, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  const cities = [];
  let lineNum = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    lineNum++;

    // Progress indicator
    if (lineNum % 5000 === 0) {
      process.stdout.write(`\rProcessed ${lineNum.toLocaleString()} lines...`);
    }

    // Skip empty lines
    if (!line.trim()) continue;

    const fields = line.split('\t');

    // Parse according to GeoNames tab-delimited format
    // Field reference: http://download.geonames.org/export/dump/readme.txt
    const city = {
      geonameId: parseInt(fields[0]),
      name: fields[1],
      ascii: fields[2].toLowerCase(),
      alternates: fields[3] ? fields[3].split(',').slice(0, 5) : [],
      lat: parseFloat(fields[4]),
      lng: parseFloat(fields[5]),
      country: fields[8],
      admin1: fields[10],
      pop: parseInt(fields[14]) || 0,
      fclass: fields[6],
      fcode: fields[7]
    };

    cities.push(city);
  }

  console.log(`\n\n✅ Parsing complete!`);
  console.log(`   Processed ${lineNum.toLocaleString()} lines`);
  console.log(`   Found ${cities.length.toLocaleString()} cities`);

  // Write output JSON
  console.log('\n💾 Writing JSON output...');
  fs.writeFileSync(outputFile, JSON.stringify(cities, null, 2));

  const fileSize = fs.statSync(outputFile).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n🎉 Success!');
  console.log(`   Cities processed: ${cities.length.toLocaleString()}`);
  console.log(`   Output file: ${outputFile}`);
  console.log(`   File size: ${fileSizeMB} MB`);
  console.log(`   Time elapsed: ${elapsed}s\n`);

  // Show sample data
  console.log('📍 Sample city (first entry):');
  console.log(JSON.stringify(cities[0], null, 2));
  console.log('\n✅ Data preparation complete! Ready for Phase 1.\n');
}

processCities().catch(err => {
  console.error('\n❌ Error during processing:');
  console.error(err);
  process.exit(1);
});
