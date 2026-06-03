const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// storage config
const upload = multer({ dest: "uploads/" });

// serve frontend
app.use(express.static("public"));

// upload endpoint
app.post("/upload", upload.single("chat"), (req, res) => {
    try {
        const filePath = path.join(__dirname, req.file.path);
        const content = fs.readFileSync(filePath, "utf-8");

        // delete temp file
        fs.unlinkSync(filePath);

        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: "File processing failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});