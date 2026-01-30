const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const OPENAI_KEY = "INCOLLA_LA_TUA_OPENAI_KEY";
const WHATSAPP_TOKEN = "INCOLLA_TOKEN_META";
const PHONE_NUMBER_ID = "INCOLLA_PHONE_NUMBER_ID";

const SYSTEM_PROMPT = `
Sei l’assistente del servizio Personal Care del Dott. Matarrese.
Parli come una segreteria reale, con tono umano, rassicurante e professionale.
Non fai diagnosi e non gestisci emergenze.
`;

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "personalcare123";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const userText = msg.text.body.toLowerCase();
  const from = msg.from;
  let replyText = "";

  const emergencyWords = ["non respira","incosciente","dolore forte al petto","sangue abbondante","infarto","ictus"];
  const jobWords = ["lavoro","cerco lavoro","sono oss","infermiere","badante","fisioterapista","collaborare"];

  if (emergencyWords.some(word => userText.includes(word))) {
    replyText = "Potrebbe essere una situazione urgente. Contatta subito il medico o il 118.";
  }

  else if (jobWords.some(word => userText.includes(word))) {
    replyText = "Grazie per il contatto. Invia nome, professione, zona di lavoro, esperienza e recapito.";
  }

  else if (userText.includes("preventivo")) {
    replyText = "Perfetto. Scrivi la tua email o 'preventivo WhatsApp'.";
  }

  else if (userText.includes("@")) {
    replyText = "Grazie, verrai ricontattato dal servizio.";
  }

  else {
    const gpt = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText }
      ]
    },{
      headers:{Authorization:`Bearer ${OPENAI_KEY}`}
    });

    replyText = gpt.data.choices[0].message.content;
  }

  await axios.post(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to: from,
    text: { body: replyText }
  },{
    headers:{Authorization:`Bearer ${WHATSAPP_TOKEN}`}
  });

  res.sendStatus(200);
});
