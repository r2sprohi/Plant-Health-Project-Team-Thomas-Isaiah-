const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection with retry logic
const connectWithRetry = () => {
  console.log("MongoDB connection with retry");
  mongoose
    .connect("mongodb://localhost:27017/esp32data", {
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

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected. Trying to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

// Define schema
const sensorDataSchema = new mongoose.Schema({
  light: Number,
  moisture1: Number,
  moisture2: Number,
  temperature: Number,
  humidity: Number,
  distance: Number,
  timestamp: { type: Date, default: Date.now },
});

const SensorData = mongoose.model("SensorData", sensorDataSchema);

// Endpoint to receive data
app.post("/api/sensor", (req, res) => {
  const data = req.body;
  console.log("Received sensor data:", data);

  const sensorData = new SensorData(data);
  sensorData
    .save()
    .then(() => res.sendStatus(200))
    .catch((err) => {
      console.error("Error saving data:", err);
      res.sendStatus(500);
    });
});

const port = 3000;
app.listen(port, () => {
  console.log('Server running on http://localhost:${port}');
});