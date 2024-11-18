const { MongoClient } = require('mongodb');

// MongoDB connection URI
const uri = 'mongodb://localhost:27017';
const dbName = 'esp32data';
const collectionName = 'sensordata';

// Helper function to generate random sensor data with Singapore time zone
function generateSensorData(timestamp) {
    const singaporeTime = new Date(timestamp.getTime() + 8 * 60 * 60 * 1000);
    return {
        moisture1: Math.floor(Math.random() * 2500),
        moisture2: Math.floor(Math.random() * 2500),
        temperature: parseFloat((Math.random() * 10 + 20).toFixed(2)),
        humidity: Math.floor(Math.random() * 100),
        distance: Math.floor(Math.random() * 40),
        light: Math.floor(Math.random() * 3000),
        timestamp: singaporeTime,
    };
}

// Function to insert bulk simulated data into the database
async function insertSimulatedData(client, startTime, interval, count, isGapFill = false) {
    const collection = client.db(dbName).collection(collectionName);
    const data = [];
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(startTime.getTime() + i * interval);
        const sensorData = generateSensorData(timestamp);
        data.push(sensorData);
        if (!isGapFill) {
            console.log(`Inserting data with moisture1: ${sensorData.moisture1}, Timestamp: ${sensorData.timestamp}`);
        }
    }

    if (data.length > 0) {
        await collection.insertMany(data);
        console.log(`Inserted ${data.length} simulated data points.`);
    }
}

// Function to backfill missing data for the specified timeframe (hours)
async function backfillMissingData(client, hours) {
    const collection = client.db(dbName).collection(collectionName);
    const now = new Date();
    const pastTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Check the latest timestamp in the database
    const latestData = await collection.find().sort({ timestamp: -1 }).limit(1).toArray();
    const lastTimestamp = latestData.length ? new Date(latestData[0].timestamp) : null;

    // If no data or gap, generate historical data for the specified timeframe
    if (!lastTimestamp || lastTimestamp < pastTime) {
        console.log(`No data or gap found. Filling missing data for the past ${hours} hours...`);
        const startTimestamp = lastTimestamp || pastTime;
        const gapCount = Math.floor((now - startTimestamp) / (10 * 1000));
        await insertSimulatedData(client, startTimestamp, 10 * 1000, gapCount, true);
    }
}

// Function to insert real-time data continuously every 10 seconds
async function insertRealTimeData(client) {
    const collection = client.db(dbName).collection(collectionName);

    while (true) {
        const now = new Date();

        // Check the latest timestamp in the database
        const latestData = await collection.find().sort({ timestamp: -1 }).limit(1).toArray();
        const lastTimestamp = latestData.length ? new Date(latestData[0].timestamp) : null;

        // If there is a gap of more than 15 seconds, fill the gap
        if (lastTimestamp && now - lastTimestamp > 15 * 1000) {
            console.log('Gap detected. Filling the gap...');
            const gapCount = Math.floor((now - lastTimestamp) / (10 * 1000));
            await insertSimulatedData(client, lastTimestamp, 10 * 1000, gapCount, true);
        }

        // Insert the next real-time data point
        const realTimeData = generateSensorData(now);
        await collection.insertOne(realTimeData);
        console.log(`Inserted real-time data with moisture1: ${realTimeData.moisture1} at: ${realTimeData.timestamp}`);

        // Wait for 10 seconds before the next insertion
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    }
}

// Main function to backfill missing data and start real-time insertion
async function main() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        // Connect to the MongoDB server
        await client.connect();
        console.log('Connected successfully to MongoDB');

        // Specify how many hours of data to backfill
        const hoursToBackfill = 24;

        // Backfill missing data for the past X hours
        await backfillMissingData(client, hoursToBackfill);

        // Start inserting real-time data
        await insertRealTimeData(client);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        // Close the connection (this won't be reached as real-time insertion runs indefinitely)
        // await client.close();
    }
}

// Run the main function
main();