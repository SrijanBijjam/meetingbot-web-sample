const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware.js");

dotenv.config();
const port = process.env.PORT || 30015;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(path.join(__dirname, "public")));

// Serve node_modules for Zoom SDK
app.use('/node_modules', express.static(path.join(__dirname, "../node_modules")));

// Error handling middleware
app.use(errorHandler);

const fs = require("fs");
const { getZoomAPIAccessToken } = require("./api/zoomAPI.js");

const zoomRoutes = require("./routes/zoomRoutes"); // Import the zoomRoutes.js file

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

console.log(__dirname);

// Main route to serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/websocket", async (req, res) => {
  try {
    const acc = await getZoomAPIAccessToken();

    // Read the HTML file
    fs.readFile("backend/public/index.html", "utf8", (err, data) => {
      if (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
        return;
      }

      // Replace the access token in the HTML code
      data = data.replace("${access_token}", acc);

      // Send the HTML code as the response
      res.send(data);
    });
  } catch (error) {
    console.error("Error handling request: ", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.use("/api/zoom", zoomRoutes); // Use the zoomRoutes.js file for all routes starting with /api/zoom

// app.use(notFound);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
