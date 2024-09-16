// Load environment variables
require('dotenv').config();

const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

const cors = require('cors');

app.use(cors());
app.use(express.json()); // For parsing JSON bodies

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/check-compatibility', async (req, res) => {
    try {
        const { medicinesList, newMedicine } = req.body;

        if (!medicinesList || !newMedicine) {
            return res.status(400).json({ error: "Medicines list or new medicine is missing" });
        }

        // Construct the professional prompt for Gemini
        const defaultText = `
          You are an AI assistant aiding a medical doctor. This doctor is checking the harmful interaction between the following medications.
          Please analyze and respond with the JSON format below:
          {
            "compatible": true or false,
            "conflictingMedicine": "Name of the conflicting medicine and with which medicine if harmful",
            "complication": "Primary complication in 1 or 2 words if harmful",
            "alternatives": ["List of alternative medicines that would no cause an interaction"]
          }
          Respond with "true" if the new medicine is compatible with all the medicines, or "false" followed by the name of the conflicting medicine and the primary complication. 
          If there's a conflict, also suggest alternative medicines that can be safely prescribed in a list format.
          If the new medicine is not a medicine response with false and add errorNotamedicine : "No valid medicine" 
        `;

        const prompt = `
          ${defaultText}
          The list of medicines currently prescribed includes: ${medicinesList.join(', ')}.
          The doctor wants to prescribe a new medicine: ${newMedicine}.
        `;

        // Generate content using Gemini
        const result = await model.generateContent([prompt]);

        // Log the raw result from Gemini for debugging
        console.log('Generated result:', result.response.text());

        // Extract the result from the model
        let generatedText = result.response.text().trim();

        // Remove extra formatting characters if present
        generatedText = generatedText.replace(/```json|```/g, '').trim();

        // Parse the JSON response from Gemini
        let response;
        try {
            response = JSON.parse(generatedText);
        } catch (error) {
            console.error('Error parsing response:', error);
            return res.status(500).json({ error: 'Failed to parse response from Gemini' });
        }

        // Validate and format the response
        if (response.compatible === true || response.compatible === false) {
            res.json({
                compatible: response.compatible,
                conflictingMedicine: response.conflictingMedicine || "Not specified",
                complication: response.complication || "Not specified",
                alternatives: response.alternatives || ["No alternatives suggested"]
            });
        } else {
            res.status(500).json({ error: 'Unexpected response format from Gemini' });
        }
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Failed to check compatibility' });
    }
});





app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
