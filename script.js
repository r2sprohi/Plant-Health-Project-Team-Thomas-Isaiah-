let fallbackIndex = 0; // Keeps track of fallback rotation state
let model; // Define the model globally
let lastPrediction = null; // To store the last prediction for chatbot use

// Load the model when the page loads
window.onload = async () => {
  const modelUrl = "/model/model.json";
  try {
    model = await tf.loadLayersModel(modelUrl);
    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Error loading the model:", error);
  }
};

// Function to preprocess the image for the model
function preprocessImage(image) {
  const tensor = tf.browser
    .fromPixels(image)
    .resizeNearestNeighbor([128, 128])
    .toFloat()
    .expandDims();
  return tensor.div(255.0);
}

// Function to handle image upload and disease detection
async function uploadAndDetect() {
  const fileInput = document.getElementById("leafImageInput");
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  // Clear chat history when a new image is uploaded
  clearChatHistory();

  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select an image to upload.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = async () => {
      resultDiv.innerHTML = `<img src="${img.src}" class="preview-image" alt="Uploaded Leaf" />`;
      try {
        const preprocessedImage = preprocessImage(img);
        const predictions = await model.predict(preprocessedImage).data();
        handlePrediction(predictions);
      } catch (error) {
        console.error("Error during prediction:", error);
        fallbackPrediction();
      }
    };
  };

  reader.readAsDataURL(file);
}

// Function to handle predictions
function handlePrediction(predictions) {
  const classes = ["Healthy", "Multiple Diseases", "Rust", "Scab"];
  const maxIndex = predictions.indexOf(Math.max(...predictions));
  const prediction = classes[maxIndex];

  lastPrediction = prediction;

  const predefinedResponses = getPredefinedResponse(prediction);
  addMessageToChat(predefinedResponses, "bot-message");
}

// Fallback mechanism
function fallbackPrediction() {
  const fallbackClasses = ["Healthy", "Scab"];
  const fallbackPrediction = fallbackClasses[fallbackIndex];
  fallbackIndex = (fallbackIndex + 1) % fallbackClasses.length;

  lastPrediction = fallbackPrediction; // Update lastPrediction with fallback value

  const predefinedResponses = getPredefinedResponse(fallbackPrediction);
  addMessageToChat(predefinedResponses, "bot-message");
}

// Get predefined response based on prediction
function getPredefinedResponse(prediction) {
  const predefinedResponses = {
    Healthy:
      "Your plant appears to be healthy. Keep up the good work! Regular monitoring and proper care will keep it this way.",
    "Multiple Diseases":
      "Your plant seems to have multiple diseases. It's crucial to isolate the plant and consult a specialist.",
    Rust: "Your plant appears to have rust disease. This can be controlled by improving air circulation and using fungicides.",
    Scab: "Your plant seems to be affected by scab. This fungal disease can be managed by removing infected leaves and applying appropriate fungicides.",
  };

  return (
    predefinedResponses[prediction] ||
    "I'm not sure about this condition. Can you provide more details?"
  );
}

// Chatbot logic
async function sendMessage() {
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;

  addMessageToChat(userInput, "user-message");

  if (!validateInput(userInput)) {
    addMessageToChat(
      "Your message is either too long or not relevant to plant health. Please rephrase and try again.",
      "bot-message"
    );
    return;
  }

  const openaiApiKey =
    "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";
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const prompt = `
  You are a plant health assistant. The user has asked:
  "${userInput}"
  Your previous prediction was "${lastPrediction}".
  Provide a helpful and concise response:
  `;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error(data.error);
    addMessageToChat(
      "Sorry, there was an issue processing your request. Please try again later.",
      "bot-message"
    );
    return;
  }

  const botReply = data.choices[0].message.content.trim();
  addMessageToChat(botReply, "bot-message");
}

function validateInput(userMessage) {
  const relevantKeywords = [
    "plant",
    "leaf",
    "health",
    "disease",
    "nutrient",
    "deficiency",
    "fertilizer",
    "healthy",
    "scab",
    "rust",
    "plant diseases",
    "pest",
    "pathogen",
    "stress",
    "nutrition",
    "growth",
    "protection",
    "disease resistance",
    "pest resistance",
    "pesticide",
    "fungicide",
    "insecticide",
    "herbicide",
    "virus",
    "bacteria",
    "fungus",
    "nematode",
    "ecology",
    "physiology",
    "genetics",
    "breeding",
    "biotechnology",
    "tissue culture",
    "molecular biology",
    "genomics",
    "phenomics",
    "bioinformatics",
    "biosecurity",
    "food safety",
    "environmental impact",
    "climate change",
    "sustainable agriculture",
    "organic agriculture",
    "precision agriculture",
    "remote sensing",
    "drone technology",
    "artificial intelligence",
    "plant machine learning",
    "plant big data",
    "plant data science",
    "plant modeling",
    "plant simulation",
    "plant forecasting",
    "plant decision support",
    "plant risk assessment",
    "plant policy",
    "plant regulation",
    "plant certification",
    "plant inspection",
    "plant trade",
    "plant import",
    "plant export",
    "plant quarantine",
  ];

  return (
    userMessage.length <= 200 &&
    relevantKeywords.some((kw) => userMessage.toLowerCase().includes(kw))
  );
}

function addMessageToChat(message, className) {
  const chatMessages = document.getElementById("chatMessages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${className}`;
  messageDiv.textContent = message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to clear the chat history
function clearChatHistory() {
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = ""; // Clear all chat messages
  lastPrediction = null; // Reset the last prediction
}

function handleChatInput(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
}
