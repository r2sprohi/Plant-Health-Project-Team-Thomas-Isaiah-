const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Temporary storage for control states of all actuators
let actuatorControlStates = {
  light: { manualControl: false, state: false },
  pump1: { manualControl: false, state: false },
  pump2: { manualControl: false, state: false },
  humidifier: { manualControl: false, state: false },
};

// MongoDB connection URI
const uri = "mongodb://localhost:27017/esp32data";

// MongoDB connection with retry logic
const connectWithRetry = () => {
  console.log("MongoDB connection with retry");
  mongoose
    .connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
      console.error("MongoDB connection error. Retrying in 5 seconds...", err);
      setTimeout(connectWithRetry, 5000); // Retry every 5 seconds
    });
};
connectWithRetry();

// MongoDB reconnection handling
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected. Trying to reconnect...");
});
mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

// Define sensor data schema
const sensorDataSchema = new mongoose.Schema({
  light: Number,
  moisture1: Number,
  moisture2: Number,
  temperature: Number,
  humidity: Number,
  distance: Number,
  timestamp: { type: Date, default: Date.now },
});

const SensorData = mongoose.model("SensorData", sensorDataSchema, "sensordata");

// Helper function to generate random sensor data for backfill
function generateSensorData(timestamp) {
  return {
    moisture1: Math.floor(Math.random() * 2500),
    moisture2: Math.floor(Math.random() * 2500),
    temperature: parseFloat((Math.random() * 10 + 20).toFixed(2)),
    humidity: Math.floor(Math.random() * 100),
    distance: Math.floor(Math.random() * 40),
    light: Math.floor(Math.random() * 3000),
    timestamp,
  };
}

// Function to insert simulated data to fill gaps
async function insertSimulatedData(startTime, interval, count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * interval);
    const sensorData = generateSensorData(timestamp);
    data.push(sensorData);
  }

  if (data.length > 0) {
    await SensorData.insertMany(data);
    console.log(`Inserted ${data.length} simulated data points to fill gap.`);
  }
}

// Function to backfill missing data for the specified timeframe
async function backfillMissingData(hours) {
  const now = new Date();
  const pastTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

  // Check the latest timestamp in the database
  const latestData = await SensorData.find().sort({ timestamp: -1 }).limit(1);
  const lastTimestamp = latestData.length ? new Date(latestData[0].timestamp) : null;

  // If no data or gap, generate historical data for the specified timeframe
  if (!lastTimestamp || lastTimestamp < pastTime) {
    console.log(`No data or gap found. Filling missing data for the past ${hours} hours...`);
    const startTimestamp = lastTimestamp || pastTime;
    const gapCount = Math.floor((now - startTimestamp) / (10 * 1000)); // 10-second intervals
    await insertSimulatedData(startTimestamp, 10 * 1000, gapCount);
  }
}

// Endpoint to receive data from the MCU
app.post("/api/sensor", async (req, res) => {
  const data = req.body;
  console.log("Received sensor data:", data);

  try {
    const sensorData = new SensorData(data);
    await sensorData.save();
    res.sendStatus(200);
  } catch (err) {
    console.error("Error saving data:", err);
    res.sendStatus(500);
  }
});

// Endpoint to set or fetch control states for all actuators
app.post("/api/control", (req, res) => {
  const { actuator, manualControl, state } = req.body;
  
  if (actuatorControlStates.hasOwnProperty(actuator)) {
    actuatorControlStates[actuator] = { manualControl, state };
    console.log(`Updated ${actuator} control state:`, actuatorControlStates[actuator]);
    res.sendStatus(200);
  } else {
    res.status(400).json({ error: "Invalid actuator" });
  }
});

app.get("/api/control", (req, res) => {
  res.json(actuatorControlStates); // Send the current states of all actuators
});

// Endpoint to fetch the latest sensor data
app.get("/api/sensor/latest", async (req, res) => {
  try {
    const latestData = await SensorData.find().sort({ timestamp: -1 }).limit(1);
    res.json(latestData[0]); // Send the latest data
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch latest sensor data" });
  }
});

// Endpoint to fetch the latest 10 historical sensor data entries
app.get("/api/sensor/history", async (req, res) => {
  try {
    const historyData = await SensorData.find().sort({ timestamp: -1 }).limit(10);
    res.json(historyData.reverse()); // Reverse to show data in chronological order
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

// Serve frontend (assuming your frontend is in the 'public' directory)
app.use(express.static("public"));

// Start the server and perform an initial backfill check
const port = 3000;
app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  const hoursToBackfill = 24; // Specify the hours for backfill
  await backfillMissingData(hoursToBackfill);
});
